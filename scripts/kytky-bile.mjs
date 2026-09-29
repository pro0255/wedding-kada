/* Bílé snítky do rohů odpočtu.
 *
 *   node scripts/kytky-bile.mjs
 *
 * Bere tytéž snítky, jaké jsou na tištěném oznámení (vyřezal je
 * scripts/kyticky-oznameni.mjs), a dělá z nich bílé siluety pro roh sekce
 * s odpočtem, která má baby blue podklad.
 *
 * Nepřebarvuje se odstín, jen se zahodí barva a nechá tvar: z každé snítky se
 * vezme průhlednost a obarví se doběla. Přetočit hue na bílou nejde — bílá
 * žádný odstín nemá.
 *
 * Alfa se navíc zesílí. Vyřezané snítky mají měkké okraje s nízkou
 * průhledností a ty na modré skoro zmizí; umocnění pod jedničkou přitáhne
 * polotóny nahoru, takže z kresby zůstane čitelná silueta a ne mlha.
 *
 * Výstup je jeden roh — hotová kompozice několika snítek. Na kartě se použije
 * čtyřikrát, pokaždé otočený, takže se nemusí skládat v CSS. */

import sharp from "sharp";
import { readdir, mkdir } from "node:fs/promises";

const ZDROJ = "public/oznameni/kyticky";
const CIL = "public/roh-kytky.png";

const SIRKA = 520;
const VYSKA = 520;

/* Které snítky do rohu a jak je posadit. Souřadnice jsou levý horní roh
 * v pixelech, `v` výška snítky. Skládané ručně: roh má vějíř z kouta ven,
 * a to náhoda neudělá. */
const ROH = [
  { i: 0, x: -20, y: -10, v: 300, uhel: 18 },
  { i: 1, x: 120, y: 30, v: 250, uhel: -32 },
  { i: 2, x: 40, y: 150, v: 270, uhel: 62 },
  { i: 3, x: 200, y: 180, v: 210, uhel: 8 },
  { i: 4, x: -10, y: 260, v: 230, uhel: 38 },
];

/* Umocnění alfy. Pod jedničkou polotóny zesvětlí, tedy zneprůhlední. */
const SILA = 0.62;

const soubory = (await readdir(ZDROJ))
  .filter((f) => /^[0-9]+[.]png$/.test(f))
  .sort();

/** Snítka jako bílá silueta: barva pryč, tvar z alfy. */
async function bila(soubor, vyska, uhel) {
  const { data, info } = await sharp(`${ZDROJ}/${soubor}`)
    .resize({ height: vyska })
    .rotate(uhel, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const ven = Buffer.alloc(info.width * info.height * 4);
  for (let p = 0; p < info.width * info.height; p++) {
    const a = data[p * 4 + 3] / 255;
    ven[p * 4] = 255;
    ven[p * 4 + 1] = 255;
    ven[p * 4 + 2] = 255;
    ven[p * 4 + 3] = Math.round(255 * Math.pow(a, SILA));
  }
  return { buffer: await sharp(ven, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer() };
}

await mkdir("public", { recursive: true });

const vrstvy = [];
for (const k of ROH) {
  const { buffer } = await bila(soubory[k.i % soubory.length], k.v, k.uhel);
  vrstvy.push({ input: buffer, left: k.x, top: k.y });
}

const info = await sharp({
  create: { width: SIRKA, height: VYSKA, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(vrstvy)
  .png({ compressionLevel: 9 })
  .toFile(CIL);

console.log(`${CIL}  ${info.width} x ${info.height} px, ${(info.size / 1024).toFixed(0)} kB, ${vrstvy.length} snítek`);
