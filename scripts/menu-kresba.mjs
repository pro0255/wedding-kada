/* Kresba prostřeného stolu na stranu menu.
 *
 *   node scripts/menu-kresba.mjs
 *
 * Předloha (public/menu/haha.jpg) je modrá perokresba na bílém papíře. Na web
 * potřebuje průhledné pozadí, aby ležela na papíře menu a ne na bílém
 * obdélníku.
 *
 * Průhlednost se bere z tmavosti: co je tmavé, je tah, co světlé, je papír.
 * Práh je schválně vysoko — přes předlohu jde bledý vodoznak a nižší práh by
 * ho protáhl na výstup jako šedý cár.
 *
 * Barva tahů se nechává původní, jen se sjednotí do modré webu: kresba je
 * kolem 210°, tedy skoro tam, kde má být, ale sytější a tmavší, než sedne
 * k drobnému textu vedle. */

import sharp from "sharp";

const ZDROJ = "public/menu/haha.jpg";
const CIL = "public/menu/prostreno.webp";

/* Modrá textu menu. */
const MODRA = [0x35, 0x60, 0x7f];

/* Prahy tmavosti. Pod spodním je papír i vodoznak, nad horním plný tah. */
const PAPIR = 58;
const TAH = 150;

/* Šířka výstupu. Na stránce je kresba široká kolem 150 px. */
const SIRKA = 360;

const prah = (v, od, do_) => {
  const t = Math.min(1, Math.max(0, (v - od) / (do_ - od)));
  return t * t * (3 - 2 * t);
};

const { data, info } = await sharp(ZDROJ).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;

const alfa = new Float32Array(W * H);
let minX = W, maxX = 0, minY = H, maxY = 0;
for (let p = 0; p < W * H; p++) {
  const jas = (data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2]) / 3;
  const a = prah(255 - jas, PAPIR, TAH);
  alfa[p] = a;
  if (a > 0.35) {
    const x = p % W, y = (p / W) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}
if (maxX < minX) throw new Error("v předloze jsem nenašel žádnou kresbu");

const sirka = maxX - minX + 1, vyska = maxY - minY + 1;
const ven = Buffer.alloc(sirka * vyska * 4);
for (let y = 0; y < vyska; y++) {
  for (let x = 0; x < sirka; x++) {
    const q = (y * sirka + x) * 4;
    ven[q] = MODRA[0]; ven[q + 1] = MODRA[1]; ven[q + 2] = MODRA[2];
    ven[q + 3] = Math.round(255 * alfa[(y + minY) * W + (x + minX)]);
  }
}

const vysledek = await sharp(ven, { raw: { width: sirka, height: vyska, channels: 4 } })
  .resize({ width: Math.min(sirka, SIRKA) })
  .webp({ quality: 92, alphaQuality: 100 })
  .toFile(CIL);

console.log(`${CIL}  ořez ${sirka}x${vyska} → ${vysledek.width}x${vysledek.height}, ${(vysledek.size / 1024).toFixed(0)} kB`);
console.log(`  poměr výška/šířka = ${(vysledek.height / vysledek.width * 100).toFixed(1)} %`);
