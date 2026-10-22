import { createHash, randomBytes } from "crypto";

/**
 * Fotky od hostů: soubory žijí v Cloudinary (free tier), metadata a lajky
 * v Redisu (hash fotek + set lajků). Smazání záznamu fotku okamžitě schová
 * z galerie (soubor v Cloudinary přežije, na free tieru nevadí).
 *
 * Hosté nemají účty — každý prohlížeč se pozná podle náhodného deviceId
 * v localStorage. Přes něj se párují „moje fotky“, mazání i lajky.
 */
import { KLIC, kratkaPamet, redis } from "./redis.ts";

type Fotka = { url: string; publicId: string; deviceId: string; nahrano: string };

/** Jedna fotka tak, jak ji vidí konkrétní zařízení (lajky, vlastnictví). */
export type FotkaVypis = {
  id: string;
  url: string;
  nahrano: string;
  lajky: number;
  lajklJsem: boolean;
  moje: boolean;
};

/** Id ve stejném tvaru jako dřív z Airtable (rec + 14 znaků), ať platí staré odkazy. */
function noveId(): string {
  const znaky = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return "rec" + [...randomBytes(14)].map((b) => znaky[b % znaky.length]).join("");
}

const lajkKlic = (fotkaId: string, deviceId: string) => `${fotkaId}:${deviceId}`;

// celá galerie pro všechna zařízení naráz; „moje“ a „lajkl jsem“ se dopočítá zvlášť
const galerie = kratkaPamet(5_000, async () => {
  const [fotky, lajky] = await redis()
    .pipeline()
    .hgetall<Record<string, Fotka>>(KLIC.fotky)
    .smembers(KLIC.lajky)
    .exec<[Record<string, Fotka> | null, string[]]>();
  return { fotky: fotky ?? {}, lajky: new Set(lajky) };
});

/** Galerie pro dané zařízení — nejnovější první. */
export async function seznamFotek(deviceId: string): Promise<FotkaVypis[]> {
  const { fotky, lajky } = await galerie.get();

  const pocty = new Map<string, number>();
  for (const l of lajky) {
    const fotkaId = l.slice(0, l.indexOf(":"));
    pocty.set(fotkaId, (pocty.get(fotkaId) ?? 0) + 1);
  }

  return Object.entries(fotky)
    .map(([id, f]) => ({
      id,
      url: f.url,
      nahrano: f.nahrano,
      lajky: pocty.get(id) ?? 0,
      lajklJsem: lajky.has(lajkKlic(id, deviceId)),
      moje: f.deviceId === deviceId,
    }))
    .sort((a, b) => b.nahrano.localeCompare(a.nahrano));
}

/** Zapíše nahranou fotku. */
export async function pridejFotku(url: string, publicId: string, deviceId: string): Promise<string> {
  const id = noveId();
  const fotka: Fotka = { url, publicId, deviceId, nahrano: new Date().toISOString() };
  await redis().hset(KLIC.fotky, { [id]: fotka });
  galerie.zahod();
  return id;
}

/** Přepne lajk zařízení na fotce. Vrací, jestli po přepnutí lajk je. */
export async function prepniLajk(fotkaId: string, deviceId: string): Promise<{ lajknuto: boolean }> {
  const klic = lajkKlic(fotkaId, deviceId);
  const odebrano = await redis().srem(KLIC.lajky, klic);
  if (odebrano === 0) await redis().sadd(KLIC.lajky, klic);
  galerie.zahod();
  return { lajknuto: odebrano === 0 };
}

/** Smaže soubor v Cloudinary (podepsaný Admin API request). */
async function smazZCloudinary(publicId: string, typ: "image" | "video"): Promise<void> {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const klic = process.env.CLOUDINARY_API_KEY;
  const tajemstvi = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !klic || !tajemstvi) {
    console.warn("[fotky] Cloudinary klíče chybí — soubor zůstává, mažu jen z galerie.");
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const podpis = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${tajemstvi}`)
    .digest("hex");

  const telo = new URLSearchParams({
    public_id: publicId,
    timestamp: String(timestamp),
    api_key: klic,
    signature: podpis,
  });
  const odpoved = await fetch(
    `https://api.cloudinary.com/v1_1/${cloud}/${typ}/destroy`,
    { method: "POST", body: telo }
  );
  if (!odpoved.ok) {
    console.warn("[fotky] Cloudinary destroy selhal:", odpoved.status, await odpoved.text());
  }
}

export type VysledekSmazani = { ok: true } | { ok: false; duvod: "cizi" | "neexistuje" };

/** Smaže fotku — jen pokud patří danému zařízení. Uklidí i její lajky. */
export async function smazFotku(
  id: string,
  deviceId: string,
  jakoSpravce = false
): Promise<VysledekSmazani> {
  const fotka = await redis().hget<Fotka>(KLIC.fotky, id);
  if (!fotka) return { ok: false, duvod: "neexistuje" };
  // host smí jen svou fotku, správce galerie kteroukoli
  if (!jakoSpravce && fotka.deviceId !== deviceId) return { ok: false, duvod: "cizi" };

  await redis().hdel(KLIC.fotky, id);
  galerie.zahod();

  if (fotka.publicId) {
    const typ = fotka.url.includes("/video/upload/") ? "video" : "image";
    await smazZCloudinary(fotka.publicId, typ);
  }

  // sirotčí lajky smazané fotky
  const sirotci = (await redis().smembers(KLIC.lajky)).filter((l) => l.startsWith(`${id}:`));
  if (sirotci.length > 0) await redis().srem(KLIC.lajky, ...sirotci);

  return { ok: true };
}
