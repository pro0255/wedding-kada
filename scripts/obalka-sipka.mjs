/* Šipka ukazující na obálku s příběhem.
 *
 *   node scripts/obalka-sipka.mjs
 *
 * Předloha (public/obalka/šipka.jpg) je červená kreslená šipka na bílém papíře.
 * Na web potřebuje průhledné pozadí a barvu podle palety — červená by ze scény
 * vystřelila jako výstražná značka.
 *
 * Průhlednost se bere z tmavosti: co je tmavé, je tah. U červené to funguje líp
 * než hledat odstín — tah má na okrajích proti bílému papíru sytost tak nízkou,
 * že by se podle ní ztratil.
 *
 * Šipka se ještě překlopí vzhůru nohama. Na předloze míří doleva nahoru, na
 * stránce má mířit doleva dolů, na pečeť. */

import sharp from "sharp";

const ZDROJ = "public/obalka/šipka.jpg";
const CIL = "public/obalka/sipka.webp";

/* Barva tahu: teplá béžová z palety webu. */
const BARVA = [0xb0, 0x96, 0x72];

/* Prahy tmavosti. Pod spodním je papír, nad horním plný tah. */
const PAPIR = 40;
const TAH = 120;

/* Šířka výstupu. Na stránce je šipka široká kolem 150 px. */
const SIRKA = 360;

/* O kolik pixelů se tah roztáhne do všech stran. Předloha je kreslená tenkým
 * fixem a na stránce se zmenšuje, takže z ní zbývala vlásečnice — tohle jí dá
 * zhruba dvojnásobnou tloušťku. */
const ZTLOUSTNUTI = 5;

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
  if (a > 0.4) {
    const x = p % W, y = (p / W) | 0;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
}
if (maxX < minX) throw new Error("v předloze jsem nenašel žádnou kresbu");

/* Ztloustnutí: každý pixel si vezme nejvyšší alfu ze svého okolí. Počítá se po
 * osách zvlášť — projít celé okolí najednou je při téhle velikosti okna
 * zbytečně pomalé a výsledek je stejný. */
const maxVOkoli = (zdroj, r) => {
  const mezi = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 0;
      for (let d = -r; d <= r; d++) {
        const xx = x + d;
        if (xx < 0 || xx >= W) continue;
        const v = zdroj[y * W + xx];
        if (v > m) m = v;
      }
      mezi[y * W + x] = m;
    }
  }
  const ven = new Float32Array(W * H);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      let m = 0;
      for (let d = -r; d <= r; d++) {
        const yy = y + d;
        if (yy < 0 || yy >= H) continue;
        const v = mezi[yy * W + x];
        if (v > m) m = v;
      }
      ven[y * W + x] = m;
    }
  }
  return ven;
};
const silna = maxVOkoli(alfa, ZTLOUSTNUTI);
minX = Math.max(0, minX - ZTLOUSTNUTI); maxX = Math.min(W - 1, maxX + ZTLOUSTNUTI);
minY = Math.max(0, minY - ZTLOUSTNUTI); maxY = Math.min(H - 1, maxY + ZTLOUSTNUTI);

const sirka = maxX - minX + 1, vyska = maxY - minY + 1;
const ven = Buffer.alloc(sirka * vyska * 4);
for (let y = 0; y < vyska; y++) {
  for (let x = 0; x < sirka; x++) {
    const q = (y * sirka + x) * 4;
    ven[q] = BARVA[0]; ven[q + 1] = BARVA[1]; ven[q + 2] = BARVA[2];
    ven[q + 3] = Math.round(255 * silna[(y + minY) * W + (x + minX)]);
  }
}

const vysledek = await sharp(ven, { raw: { width: sirka, height: vyska, channels: 4 } })
  .flip()
  .resize({ width: Math.min(sirka, SIRKA) })
  .webp({ quality: 92, alphaQuality: 100 })
  .toFile(CIL);

console.log(`${CIL}  ořez ${sirka}x${vyska} → ${vysledek.width}x${vysledek.height}, ${(vysledek.size / 1024).toFixed(0)} kB`);
console.log(`  poměr výška/šířka = ${(vysledek.height / vysledek.width * 100).toFixed(1)} %`);
