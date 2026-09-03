import { apiTabulky, doFormule, nactiZaznamy, vlozZaznam } from "./airtable.ts";
import { HRY, type HraSlug } from "./schemata.ts";

export { HRY, type HraSlug };

/**
 * Skóre ze her. Každé dohrání je řádek v tabulce „Skore“; žebříček se skládá
 * až tady — nejlepší výsledek na zařízení a hru. Jména bere z „Hoste“.
 */

const API_SKORE = apiTabulky("Skore");
const API_HOSTE = apiTabulky("Hoste");
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

type SkoreFields = { DeviceId?: string; Hra?: string; "Skóre"?: number; Kdy?: string };
type HostFields = { DeviceId?: string; "Jméno"?: string };

export async function zebricek(hra: HraSlug, mojeDevice: string): Promise<Zebricek> {
  const [skore, hoste] = await Promise.all([
    nactiZaznamy<SkoreFields>(API_SKORE, `{Hra}='${doFormule(hra)}'`),
    nactiZaznamy<HostFields>(API_HOSTE),
  ]);
  const jmena = new Map<string, string>();
  for (const h of hoste) {
    if (h.fields.DeviceId && h.fields["Jméno"]) jmena.set(h.fields.DeviceId, h.fields["Jméno"]);
  }
  const platne: { deviceId: string; skore: number }[] = [];
  for (const s of skore) {
    const d = s.fields.DeviceId;
    const b = s.fields["Skóre"];
    if (d && typeof b === "number") platne.push({ deviceId: d, skore: b });
  }
  return sestavZebricek(platne, jmena, mojeDevice);
}

export async function ulozSkore(hra: HraSlug, deviceId: string, skore: number): Promise<void> {
  await vlozZaznam<SkoreFields>(API_SKORE, {
    DeviceId: deviceId,
    Hra: hra,
    "Skóre": skore,
    Kdy: new Date().toISOString(),
  });
}

export type Lidr = { jmeno: string; skore: number } | null;

/** Nejlepší hráč každé hry — pro karty ve výběru. Jedno načtení pro všechny hry. */
export async function lidri(): Promise<Record<HraSlug, Lidr>> {
  const [skore, hoste] = await Promise.all([
    nactiZaznamy<SkoreFields>(API_SKORE),
    nactiZaznamy<HostFields>(API_HOSTE),
  ]);
  const jmena = new Map<string, string>();
  for (const h of hoste) {
    if (h.fields.DeviceId && h.fields["Jméno"]) jmena.set(h.fields.DeviceId, h.fields["Jméno"]);
  }
  const out = Object.fromEntries(HRY.map((h) => [h, null])) as Record<HraSlug, Lidr>;
  for (const s of skore) {
    const hra = s.fields.Hra;
    const b = s.fields["Skóre"];
    if (!hra || !(HRY as readonly string[]).includes(hra) || typeof b !== "number" || !s.fields.DeviceId) continue;
    const cur = out[hra as HraSlug];
    if (!cur || b > cur.skore) out[hra as HraSlug] = { jmeno: jmena.get(s.fields.DeviceId) ?? NEZNAMY, skore: b };
  }
  return out;
}
