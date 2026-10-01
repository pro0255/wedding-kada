/* Vystřižené květiny pro web.
 *
 *   node scripts/kytky-web.mjs
 *
 * Předlohy v public/cut outs/png jsou vystřižené květiny s průhledným pozadím,
 * každá kolem půl megabajtu — dohromady přes osm, což je na jednu sekci webu
 * neúnosné. Skript je zmenší na velikost, v jaké se opravdu zobrazují, ořízne
 * průhledný okraj a uloží jako WebP.
 *
 * Ořez je důležitější, než se zdá: kolem vystřižené květiny bývá půl obrázku
 * prázdna a v CSS by se pak poloha zadávala vůči tomu prázdnu, ne vůči květině.
 * Po ořezu drží každá obrázek přesně své rozměry a dá se posadit na milimetr.
 *
 * Výstup si ponechá pořadové číslo z názvu, aby se v public/kytky dalo poznat,
 * která je která — v CSS se na ně odkazuje jménem.
 */

import sharp from "sharp";
import { readdir, mkdir } from "node:fs/promises";

const ZDROJ = "public/cut outs/png";
const CIL = "public/kytky";

/* Největší rozměr výstupu. Na webu jsou květiny široké nanejvýš kolem 260 px,
 * tohle je rezerva na displeje s dvojnásobnou hustotou. */
const MAX = 560;

/* Závoje u odpočtu jsou na stránce vysoké přes půl obrazovky, takže se ukládají
 * větší — v 560 px by byly rozmazané. */
const VELKE = new Set(["zavoj_program_vlevo_nahore_v2", "zavoj_program_vpravo_dole"]);
const MAX_VELKE = 1000;

/* Pod touhle průhledností se pixel bere jako prázdno a ořeže se. */
const PRAH_ALFY = 12;

await mkdir(CIL, { recursive: true });

const soubory = (await readdir(ZDROJ)).filter((f) => /\.png$/i.test(f)).sort();
if (!soubory.length) console.log(`v ${ZDROJ} nejsou žádné png`);

for (const soubor of soubory) {
  const { data, info } = await sharp(`${ZDROJ}/${soubor}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let p = 0; p < W * H; p++) {
    if (data[p * 4 + 3] < PRAH_ALFY) continue;
    const x = p % W, y = (p / W) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (maxX < minX) { console.log(`${soubor}: celý průhledný, přeskakuji`); continue; }

  const sirka = maxX - minX + 1, vyska = maxY - minY + 1;
  const klic = soubor.replace(/\.png$/i, "");
  const vysledek = await sharp(`${ZDROJ}/${soubor}`)
    .extract({ left: minX, top: minY, width: sirka, height: vyska })
    .resize({
      width: VELKE.has(klic) ? MAX_VELKE : MAX,
      height: VELKE.has(klic) ? MAX_VELKE : MAX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: VELKE.has(klic) ? 80 : 88, alphaQuality: 100 })
    .toFile(`${CIL}/${klic}.webp`);

  console.log(
    `${klic}  ${W}x${H} → ořez ${sirka}x${vyska} → ${vysledek.width}x${vysledek.height}, `
    + `${(vysledek.size / 1024).toFixed(0)} kB, poměr ${(vysledek.height / vysledek.width).toFixed(2)}`,
  );
}
