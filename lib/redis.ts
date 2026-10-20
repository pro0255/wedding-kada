import { Redis } from "@upstash/redis";

/**
 * Upstash Redis (Vercel Marketplace, free tier 500k příkazů/měsíc) — živá data
 * ze svatebního dne: fotky, lajky, skóre a jména. Airtable free má jen
 * 1 000 volání za měsíc, to galerie při 50 hostech projede za pár minut.
 * Proměnné mají prefix SVATBA_, protože KV_* zůstaly po starém úložišti.
 */
let klient: Redis | null = null;

/** Je Redis vůbec nastavený? Tam, kde slouží jen jako cache, se bez něj dá
 *  obejít — volající si pak data načte z pomalejšího zdroje. */
export function maRedis(): boolean {
  return Boolean(process.env.SVATBA_KV_REST_API_URL && process.env.SVATBA_KV_REST_API_TOKEN);
}

export function redis(): Redis {
  if (!klient) {
    const url = process.env.SVATBA_KV_REST_API_URL;
    const token = process.env.SVATBA_KV_REST_API_TOKEN;
    if (!url || !token) throw new Error("Chybí SVATBA_KV_REST_API_URL / _TOKEN v prostředí.");
    klient = new Redis({ url, token });
  }
  return klient;
}

/** Klíče na jednom místě, ať se nerozjedou mezi moduly a migračním skriptem. */
export const KLIC = {
  fotky: "svatba:fotky", // hash id → { url, publicId, deviceId, nahrano }
  lajky: "svatba:lajky", // set "fotkaId:deviceId"
  hoste: "svatba:hoste", // hash deviceId → jméno
  skore: (hra: string) => `svatba:skore:${hra}`, // zset deviceId → nejlepší skóre
  ubytovani: "svatba:ubytovani:stav", // cache kapacity z Airtable
  vstupPokusy: (ip: string) => `svatba:vstup:${ip}`, // počet špatných odpovědí u vstupu do galerie za minutu
} as const;

/**
 * Krátká paměť v rámci jedné instance funkce: když galerii obnovuje 50 telefonů
 * naráz, do Redisu jde jen jeden dotaz za `ms`. Zápis v téže instanci ji zahodí.
 */
export function kratkaPamet<T>(ms: number, nacti: () => Promise<T>) {
  let hodnota: { data: Promise<T>; do: number } | null = null;
  return {
    get(): Promise<T> {
      if (!hodnota || hodnota.do < Date.now()) {
        const data = nacti();
        hodnota = { data, do: Date.now() + ms };
        data.catch(() => (hodnota = null));
      }
      return hodnota.data;
    },
    zahod() {
      hodnota = null;
    },
  };
}
