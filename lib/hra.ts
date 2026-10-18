import { vsechnaJmena } from "./host.ts";
import { KLIC, kratkaPamet, redis } from "./redis.ts";
import { HRY, type HraSlug } from "./schemata.ts";

export { HRY, type HraSlug };

/**
 * Skóre ze her. Pro každou hru sorted set v Redisu, kde si zařízení drží jen
 * svůj nejlepší výsledek (ZADD GT). Žebříček se skládá tady, jména z hostů.
 */

export const NEZNAMY = "Neznámý host";

export type Radek = { poradi: number; jmeno: string; skore: number; moje: boolean };
export type Zebricek = { radky: Radek[]; moje?: { poradi: number; skore: number } };

export function sestavZebricek(
  skore: { deviceId: string; skore: number }[],
  jmena: Map<string, string>,
  mojeDevice: string,
  limit = 10,
): Zebricek {
  const nejlepsi = new Map<string, number>();
  for (const s of skore) {
    const max = nejlepsi.get(s.deviceId);
    if (max === undefined || s.skore > max) nejlepsi.set(s.deviceId, s.skore);
  }
  const serazene = [...nejlepsi.entries()].sort((a, b) => b[1] - a[1]);

  // stejné skóre = stejné pořadí (1, 1, 3), jako ve sportu
  const radkyVse: Radek[] = [];
  let poradi = 0;
  serazene.forEach(([deviceId, s], i) => {
    if (i === 0 || s !== serazene[i - 1][1]) poradi = i + 1;
    radkyVse.push({
      poradi,
      jmeno: jmena.get(deviceId) ?? NEZNAMY,
      skore: s,
      moje: deviceId === mojeDevice,
    });
  });

  const muj = radkyVse.find((r) => r.moje);
  return {
    radky: radkyVse.slice(0, limit),
    moje: muj ? { poradi: muj.poradi, skore: muj.skore } : undefined,
  };
}

// skóre všech her + jména; žebříčky se obnovují každých 30 s na každém telefonu
const vse = kratkaPamet(5_000, async () => {
  const p = redis().pipeline();
  for (const hra of HRY) p.zrange(KLIC.skore(hra), 0, -1, { withScores: true });
  const [vysledky, jmena] = await Promise.all([p.exec<(string | number)[][]>(), vsechnaJmena()]);
  const skore = Object.fromEntries(
    HRY.map((hra, i) => {
      const plochy = vysledky[i] ?? [];
      const radky: { deviceId: string; skore: number }[] = [];
      for (let j = 0; j < plochy.length; j += 2) {
        radky.push({ deviceId: String(plochy[j]), skore: Number(plochy[j + 1]) });
      }
      return [hra, radky];
    }),
  ) as Record<HraSlug, { deviceId: string; skore: number }[]>;
  return { skore, jmena };
});

export async function zebricek(hra: HraSlug, mojeDevice: string): Promise<Zebricek> {
  const { skore, jmena } = await vse.get();
  return sestavZebricek(skore[hra], jmena, mojeDevice);
}

export async function ulozSkore(hra: HraSlug, deviceId: string, skore: number): Promise<void> {
  await redis().zadd(KLIC.skore(hra), { gt: true }, { score: skore, member: deviceId });
  vse.zahod();
}

export type Lidr = { jmeno: string; skore: number } | null;

/** Nejlepší hráč každé hry — pro karty ve výběru. Jedno načtení pro všechny hry. */
export async function lidri(): Promise<Record<HraSlug, Lidr>> {
  const { skore, jmena } = await vse.get();
  const out = Object.fromEntries(HRY.map((h) => [h, null])) as Record<HraSlug, Lidr>;
  for (const hra of HRY) {
    for (const s of skore[hra]) {
      const cur = out[hra];
      if (!cur || s.skore > cur.skore) out[hra] = { jmeno: jmena.get(s.deviceId) ?? NEZNAMY, skore: s.skore };
    }
  }
  return out;
}
