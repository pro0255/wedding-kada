import { createHash } from "crypto";

/**
 * Fotky od hostů: soubory žijí v Cloudinary (free tier), metadata a lajky
 * v Airtable — stejná base jako rezervace ubytování. Smazání řádku v tabulce
 * „Fotky“ fotku okamžitě schová z galerie (soubor v Cloudinary přežije,
 * na free tieru nevadí).
 *
 * Hosté nemají účty — každý prohlížeč se pozná podle náhodného deviceId
 * v localStorage. Přes něj se párují „moje fotky“, mazání i lajky.
 */
import { apiTabulky, doFormule, hlavicky, nactiZaznamy as nactiObecne } from "./airtable.ts";
import type { Zaznam as ZaznamObecny } from "./airtable.ts";

const API_FOTKY = apiTabulky("Fotky");
const API_LAJKY = apiTabulky("Lajky");

type Zaznam = ZaznamObecny<Record<string, string | undefined>>;
const nactiZaznamy = (api: string, filtr?: string) =>
  nactiObecne<Record<string, string | undefined>>(api, filtr);

/** Jedna fotka tak, jak ji vidí konkrétní zařízení (lajky, vlastnictví). */
export type FotkaVypis = {
  id: string;
  url: string;
  nahrano: string;
  lajky: number;
  lajklJsem: boolean;
  moje: boolean;
};

/** Galerie pro dané zařízení — nejnovější první. */
export async function seznamFotek(deviceId: string): Promise<FotkaVypis[]> {
  const [fotky, lajky] = await Promise.all([
    nactiZaznamy(API_FOTKY),
    nactiZaznamy(API_LAJKY),
  ]);

  const pocty = new Map<string, number>();
  const moje = new Set<string>();
  for (const l of lajky) {
    const fotkaId = l.fields.FotkaId ?? "";
    pocty.set(fotkaId, (pocty.get(fotkaId) ?? 0) + 1);
    if (l.fields.DeviceId === deviceId) moje.add(fotkaId);
  }

  return fotky
    .filter((f) => !!f.fields.Url)
    .map((f) => ({
      id: f.id,
      url: f.fields.Url!,
      nahrano: f.fields["Nahráno"] ?? "",
      lajky: pocty.get(f.id) ?? 0,
      lajklJsem: moje.has(f.id),
      moje: f.fields.DeviceId === deviceId,
    }))
    .sort((a, b) => b.nahrano.localeCompare(a.nahrano));
}

/** Zapíše nahranou fotku do Airtable. */
export async function pridejFotku(
  url: string,
  publicId: string,
  deviceId: string
): Promise<string> {
  const odpoved = await fetch(API_FOTKY, {
    method: "POST",
    headers: hlavicky(),
    body: JSON.stringify({
      records: [
        {
          fields: {
            Url: url,
            PublicId: publicId,
            DeviceId: deviceId,
            "Nahráno": new Date().toISOString(),
          },
        },
      ],
    }),
  });
  if (!odpoved.ok) {
    throw new Error(`Airtable vrátil ${odpoved.status}: ${await odpoved.text()}`);
  }
  const data = (await odpoved.json()) as { records: { id: string }[] };
  return data.records[0].id;
}

/** Přepne lajk zařízení na fotce. Vrací, jestli po přepnutí lajk je. */
export async function prepniLajk(
  fotkaId: string,
  deviceId: string
): Promise<{ lajknuto: boolean }> {
  const existujici = await nactiZaznamy(
    API_LAJKY,
    `AND({FotkaId}='${doFormule(fotkaId)}',{DeviceId}='${doFormule(deviceId)}')`
  );

  if (existujici.length > 0) {
    const url = new URL(API_LAJKY);
    for (const l of existujici) url.searchParams.append("records[]", l.id);
    const odpoved = await fetch(url, { method: "DELETE", headers: hlavicky() });
    if (!odpoved.ok) {
      throw new Error(`Airtable vrátil ${odpoved.status}: ${await odpoved.text()}`);
    }
    return { lajknuto: false };
  }

  const odpoved = await fetch(API_LAJKY, {
    method: "POST",
    headers: hlavicky(),
    body: JSON.stringify({
      records: [{ fields: { FotkaId: fotkaId, DeviceId: deviceId } }],
    }),
  });
  if (!odpoved.ok) {
    throw new Error(`Airtable vrátil ${odpoved.status}: ${await odpoved.text()}`);
  }
  return { lajknuto: true };
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
  deviceId: string
): Promise<VysledekSmazani> {
  const odpoved = await fetch(`${API_FOTKY}/${id}`, { headers: hlavicky(), cache: "no-store" });
  if (odpoved.status === 404) return { ok: false, duvod: "neexistuje" };
  if (!odpoved.ok) {
    throw new Error(`Airtable vrátil ${odpoved.status}: ${await odpoved.text()}`);
  }
  const zaznam = (await odpoved.json()) as Zaznam;
  if (zaznam.fields.DeviceId !== deviceId) return { ok: false, duvod: "cizi" };

  const smazani = await fetch(`${API_FOTKY}/${id}`, { method: "DELETE", headers: hlavicky() });
  if (!smazani.ok) {
    throw new Error(`Airtable vrátil ${smazani.status}: ${await smazani.text()}`);
  }

  if (zaznam.fields.PublicId) {
    const typ = zaznam.fields.Url?.includes("/video/upload/") ? "video" : "image";
    await smazZCloudinary(zaznam.fields.PublicId, typ);
  }

  // sirotčí lajky smazané fotky — po 10, víc Airtable v jednom requestu nevezme
  const lajky = await nactiZaznamy(API_LAJKY, `{FotkaId}='${doFormule(id)}'`);
  for (let i = 0; i < lajky.length; i += 10) {
    const url = new URL(API_LAJKY);
    for (const l of lajky.slice(i, i + 10)) url.searchParams.append("records[]", l.id);
    await fetch(url, { method: "DELETE", headers: hlavicky() });
  }

  return { ok: true };
}
