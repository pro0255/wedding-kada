import { HRY } from "./hry.ts";
import { KLIC, redis } from "./redis.ts";

/**
 * Úklid testovacích dat před ostrým provozem: skóre her, jména hostů,
 * fotky s lajky (i soubory v Cloudinary) a počítadla pokusů u vstupu.
 * Rezervace ubytování se nemažou nikdy — žijí v Airtable a /admin je jen
 * ukazuje. Spouští se z /admin (tlačítko se správcovským heslem) nebo
 * skriptem scripts/uklid.mjs.
 */

export type PrehledUklidu = {
  skore: Record<(typeof HRY)[number], number>;
  jmena: number;
  fotky: number;
  lajky: number;
};

type Soubor = { publicId: string; typ: "image" | "video" };
type Fotka = { url: string; publicId?: string };

/** Kolik čeho by úklid smazal. */
export async function prehledUklidu(): Promise<PrehledUklidu> {
  const p = redis().pipeline();
  for (const hra of HRY) p.zcard(KLIC.skore(hra));
  p.hlen(KLIC.hoste).hlen(KLIC.fotky).scard(KLIC.lajky);
  const pocty = await p.exec<number[]>();
  const [jmena, fotky, lajky] = pocty.slice(HRY.length);
  return {
    skore: Object.fromEntries(HRY.map((h, i) => [h, pocty[i]])) as PrehledUklidu["skore"],
    jmena,
    fotky,
    lajky,
  };
}

async function klicePokusu(): Promise<string[]> {
  const klice: string[] = [];
  let kurzor = "0";
  do {
    const [dalsi, nalezene] = await redis().scan(kurzor, { match: "svatba:vstup:*", count: 200 });
    kurzor = String(dalsi);
    klice.push(...nalezene);
  } while (kurzor !== "0");
  return klice;
}

/** Smaže soubory v Cloudinary hromadně (Admin API, po 100). */
async function smazZCloudinary(soubory: Soubor[]): Promise<void> {
  if (soubory.length === 0) return;
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const klic = process.env.CLOUDINARY_API_KEY;
  const tajemstvi = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !klic || !tajemstvi) throw new Error("Chybí klíče ke Cloudinary.");
  const auth = Buffer.from(`${klic}:${tajemstvi}`).toString("base64");

  for (const typ of ["image", "video"] as const) {
    const ids = soubory.filter((s) => s.typ === typ).map((s) => s.publicId);
    for (let i = 0; i < ids.length; i += 100) {
      const url = new URL(`https://api.cloudinary.com/v1_1/${cloud}/resources/${typ}/upload`);
      for (const id of ids.slice(i, i + 100)) url.searchParams.append("public_ids[]", id);
      const r = await fetch(url, { method: "DELETE", headers: { Authorization: `Basic ${auth}` } });
      if (!r.ok) throw new Error(`Cloudinary vrátil ${r.status}: ${await r.text()}`);
    }
  }
}

/** Smaže všechno kromě rezervací. Vrací, co bylo smazáno. */
export async function uklid(): Promise<PrehledUklidu> {
  const pred = await prehledUklidu();
  const fotky = (await redis().hgetall<Record<string, Fotka>>(KLIC.fotky)) ?? {};
  const soubory: Soubor[] = Object.values(fotky)
    .filter((f): f is Fotka & { publicId: string } => Boolean(f.publicId))
    .map((f) => ({
      publicId: f.publicId,
      typ: f.url.includes("/video/upload/") ? "video" : "image",
    }));

  // Cloudinary napřed: když selže, záznamy zůstanou a úklid jde zopakovat
  await smazZCloudinary(soubory);
  await redis().del(
    ...HRY.map((h) => KLIC.skore(h)),
    KLIC.hoste,
    KLIC.fotky,
    KLIC.lajky,
    ...(await klicePokusu()),
  );
  return pred;
}
