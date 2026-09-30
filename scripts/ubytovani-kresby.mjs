/* Kresby k ubytování.
 *
 *   node scripts/ubytovani-kresby.mjs
 *
 * Z předloh v public/ubytování vyřízne hotelový vozík a snídani, odmaskuje
 * pozadí a obojí sjednotí do jedné barvy. Obě předlohy jsou archy s dalšími
 * kresbami a s cizím názvem, takže se z nich bere jen zadaný obdélník; přesný
 * ořez na kresbu si skript dotáhne sám podle inkoustu.
 *
 * Průhlednost se bere z tmavosti: co je tmavé, je tah, co světlé, je papír.
 * Barva se nastaví natvrdo na hnědou z ikonek programu — vozík je na předloze
 * vínový, snídaně černá, a vedle sebe by si nesedly. */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

/* Stejný tón jako ikonky v programu (scripts/program-ikony.mjs) — kresby na
 * webu mají vypadat jako jedna ruka. */
const BARVA = [0x6b, 0x53, 0x40];

const SLOZKA = "public/ubytování";
const CIL = "public/ubytovani";

const KRESBY = [
  /* Vozík je v levém horním rohu archu, vedle něj stojí poslíček — výřez ho
     nesmí zasáhnout. */
  { zdroj: "vozik.jpg", klic: "vozik", papir: 30,
    oblast: { left: 100, top: 60, width: 360, height: 556 } },
  /* Snídaně je nad nápisem SUNDAY BRUNCH; ten do výřezu nepatří. */
  { zdroj: "snidane.jpg", klic: "snidane", papir: 40,
    oblast: { left: 50, top: 340, width: 650, height: 450 } },
];

/* Šířka výstupu; na stránce jsou kresby široké kolem 220 px. */
const SIRKA = 520;

/* Nad tímhle prahem tmavosti je plný tah. */
const TAH = 150;

const prah = (v, od, do_) => {
  const t = Math.min(1, Math.max(0, (v - od) / (do_ - od)));
  return t * t * (3 - 2 * t);
};

await mkdir(CIL, { recursive: true });

for (const k of KRESBY) {
  const { data, info } = await sharp(`${SLOZKA}/${k.zdroj}`)
    .extract(k.oblast)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  const alfa = new Float32Array(W * H);
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let p = 0; p < W * H; p++) {
    const jas = (data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2]) / 3;
    const a = prah(255 - jas, k.papir, TAH);
    alfa[p] = a;
    if (a > 0.35) {
      const x = p % W, y = (p / W) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) { console.log(`${k.klic}: v zadané oblasti není žádná kresba`); continue; }

  const sirka = maxX - minX + 1, vyska = maxY - minY + 1;
  const ven = Buffer.alloc(sirka * vyska * 4);
  for (let y = 0; y < vyska; y++) {
    for (let x = 0; x < sirka; x++) {
      const q = (y * sirka + x) * 4;
      ven[q] = BARVA[0]; ven[q + 1] = BARVA[1]; ven[q + 2] = BARVA[2];
      ven[q + 3] = Math.round(255 * alfa[(y + minY) * W + (x + minX)]);
    }
  }

  const vysledek = await sharp(ven, { raw: { width: sirka, height: vyska, channels: 4 } })
    .resize({ width: Math.min(sirka, SIRKA) })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(`${CIL}/${k.klic}.webp`);

  console.log(`${k.klic}  ořez ${sirka}x${vyska} → ${vysledek.width}x${vysledek.height}, ${(vysledek.size / 1024).toFixed(0)} kB, poměr ${(vysledek.height / vysledek.width).toFixed(2)}`);
}
