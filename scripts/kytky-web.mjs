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
 *
 * Předlohy v ROZREZAT nesou víc květů v jednom souboru. Věnec na stránce je
 * skládá jednotlivě, na různá místa a v různých velikostech, takže se rozdělí
 * na samostatné kusy: souvislé ostrovy neprůhledných pixelů se najdou záplavou
 * a každý se uloží zvlášť pod příponou -1, -2… Celek zůstane taky, pro místa,
 * kde se hodí trs. */

import sharp from "sharp";
import { readdir, mkdir } from "node:fs/promises";

const ZDROJ = "public/cut outs/png";
const CIL = "public/kytky";

/* Největší rozměr výstupu. Na webu jsou květiny široké nanejvýš kolem 260 px,
 * tohle je rezerva na displeje s dvojnásobnou hustotou. */
const MAX = 560;

/* Pod touhle průhledností se pixel bere jako prázdno a ořeže se. */
const PRAH_ALFY = 12;

/* Předlohy, které nesou víc samostatných květů. */
const ROZREZAT = new Set(["01_kvetiny_bile", "08_krasenka", "13_karafiat"]);

/* Ostrov menší než tenhle díl plochy předlohy je úlomek okvětního lístku nebo
 * zbytek po vystřihování, ne květ. */
const NEJMENSI_OSTROV = 0.012;

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
    .resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 100 })
    .toFile(`${CIL}/${klic}.webp`);

  console.log(
    `${klic}  ${W}x${H} → ořez ${sirka}x${vyska} → ${vysledek.width}x${vysledek.height}, `
    + `${(vysledek.size / 1024).toFixed(0)} kB, poměr ${(vysledek.height / vysledek.width).toFixed(2)}`,
  );

  if (!ROZREZAT.has(klic)) continue;

  /* Záplava přes neprůhledné pixely: každý souvislý ostrov je jeden květ.
     Zásobník je pole, ne rekurze — ostrovy mají statisíce pixelů a rekurze by
     přetekla zásobník volání. */
  const oznaceni = new Int32Array(W * H);
  const ostrovy = [];
  for (let start = 0; start < W * H; start++) {
    if (oznaceni[start] || data[start * 4 + 3] < PRAH_ALFY) continue;
    const cislo = ostrovy.length + 1;
    let x1 = W, x2 = 0, y1 = H, y2 = 0, pocet = 0;
    const zasobnik = [start];
    oznaceni[start] = cislo;
    while (zasobnik.length) {
      const q = zasobnik.pop();
      const qx = q % W, qy = (q / W) | 0;
      pocet++;
      if (qx < x1) x1 = qx;
      if (qx > x2) x2 = qx;
      if (qy < y1) y1 = qy;
      if (qy > y2) y2 = qy;
      const sousedi = [
        qx > 0 ? q - 1 : -1, qx < W - 1 ? q + 1 : -1,
        qy > 0 ? q - W : -1, qy < H - 1 ? q + W : -1,
      ];
      for (const n of sousedi) {
        if (n < 0 || oznaceni[n] || data[n * 4 + 3] < PRAH_ALFY) continue;
        oznaceni[n] = cislo;
        zasobnik.push(n);
      }
    }
    ostrovy.push({ x1, x2, y1, y2, pocet });
  }

  /* Shora dolů, ať pořadová čísla odpovídají tomu, jak květy na předloze leží. */
  const kvety = ostrovy
    .filter((o) => o.pocet > W * H * NEJMENSI_OSTROV)
    .sort((a, b) => a.y1 - b.y1);
  if (kvety.length < 2) {
    console.log(`  (${klic}: jeden kus, nerozřezávám)`);
    continue;
  }

  for (let i = 0; i < kvety.length; i++) {
    const { x1, x2, y1, y2 } = kvety[i];
    const w = x2 - x1 + 1, h = y2 - y1 + 1;
    const kus = await sharp(`${ZDROJ}/${soubor}`)
      .extract({ left: x1, top: y1, width: w, height: h })
      .resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88, alphaQuality: 100 })
      .toFile(`${CIL}/${klic}-${i + 1}.webp`);
    console.log(
      `  ${klic}-${i + 1}  ${w}x${h} → ${kus.width}x${kus.height}, `
      + `${(kus.size / 1024).toFixed(0)} kB, poměr ${(kus.height / kus.width).toFixed(2)}`,
    );
  }
}
