/* Jednotlivé snítky pro tištěné oznámení.
 *
 *   node scripts/kyticky-oznameni.mjs
 *
 * Předloha je arch v public/fotky/oznámení/kytičky.jpg — asi třicet drobných
 * akvarelových kytek na krémovém papíře. Skript z něj vyřízne každou zvlášť,
 * aby se daly po kartě rozházet jako na předloze.
 *
 * Jak se odděluje pozadí:
 *
 * 1. Papír archu (254, 250, 246) se po kanálech přepočítá na papír karty
 *    (#fbfaf8). Je to jen mírné vyvážení bílé — vztahy mezi barvami zůstanou.
 *    Po tomhle kroku má pozadí archu přesně barvu karty, takže i kdyby v masce
 *    zůstal kus papíru navíc, není ho vidět.
 *
 * 2. Průhlednost se bere z odchylky od té barvy papíru s měkkým prahem.
 *    Barvy se schválně NEPŘEPOČÍTÁVAJÍ zpátky přes „un-multiply“: akvarel je
 *    barva rozmytá do papíru a dělit ji alfou znamená vynásobit bledé odstíny
 *    deseti a dostat neon. Tady to není potřeba — papír karty a papír archu
 *    mají po kroku 1 stejnou barvu, takže bledé okraje vyjdou správně samy.
 *
 * Pak se maska rozdělí na souvislé plochy (osmisousedství) a každá dost velká
 * se uloží jako vlastní PNG. Nejmenší smítka a JPEG šum vypadnou přes práh na
 * počet pixelů, jinak by ve složce skončilo dvě stě teček.
 *
 * Do výřezu se propíše jen ta jedna plocha. Sousední kytky, které zasahují do
 * jejího obdélníku, se umažou — jinak by na kartě u snítky visel utržený kus
 * cizí kytky.
 *
 * Vedle toho vzniká přehledový arch nahled.png se všemi snítkami, aby se dalo
 * vybrat okem, co půjde na kartu. */

import sharp from "sharp";
import { mkdir, rm } from "node:fs/promises";

const PREDLOHA = "public/fotky/oznámení/kytičky.jpg";
const KAM = "public/oznameni/kyticky";

const PAPIR_ARCHU = [254, 250, 246];
const PAPIR_KARTY = [251, 250, 248];

/* Měkký práh průhlednosti: pod DOLE je to papír, nad NAHORE plná barva. */
const DOLE = 5;
const NAHORE = 16;

/* Co je menší, je smítko nebo šum, ne kytka. */
const NEJMENE_PIXELU = 900;
const NEJMENE_STRANA = 24;

/* Kolem výřezu se nechá pár pixelů vzduchu, ať okraj nekončí přesně na tahu. */
const OKRAJ = 4;

const nabeh = (t) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

const { data, info } = await sharp(PREDLOHA).raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

const zisk = PAPIR_KARTY.map((k, i) => k / PAPIR_ARCHU[i]);

/* Vyvážený obrázek a maska průhlednosti v jednom průchodu. */
const rgba = Buffer.alloc(W * H * 4);
const alfa = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) {
  const i = p * C;
  let odchylka = 0;
  for (let c = 0; c < 3; c++) {
    const v = Math.min(255, Math.round(data[i + c] * zisk[c]));
    rgba[p * 4 + c] = v;
    odchylka = Math.max(odchylka, Math.abs(v - PAPIR_KARTY[c]));
  }
  const a = Math.round(255 * nabeh((odchylka - DOLE) / (NAHORE - DOLE)));
  rgba[p * 4 + 3] = a;
  alfa[p] = a;
}

/* Souvislé plochy. Iterativní zásobník, ne rekurze — kytka přes tisíce pixelů
 * by rekurzí přetekla zásobník. */
const PRAH_MASKY = 40;
const stitek = new Int32Array(W * H).fill(-1);
const plochy = [];
const zasobnik = new Int32Array(W * H);

for (let start = 0; start < W * H; start++) {
  if (alfa[start] < PRAH_MASKY || stitek[start] !== -1) continue;
  const id = plochy.length;
  let vrchol = 0;
  zasobnik[vrchol++] = start;
  stitek[start] = id;
  let pocet = 0;
  let x1 = W, y1 = H, x2 = 0, y2 = 0;

  while (vrchol > 0) {
    const p = zasobnik[--vrchol];
    const x = p % W;
    const y = (p / W) | 0;
    pocet++;
    if (x < x1) x1 = x;
    if (x > x2) x2 = x;
    if (y < y1) y1 = y;
    if (y > y2) y2 = y;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (stitek[q] !== -1 || alfa[q] < PRAH_MASKY) continue;
        stitek[q] = id;
        zasobnik[vrchol++] = q;
      }
    }
  }
  plochy.push({ pocet, x1, y1, x2, y2 });
}

const vybrane = plochy
  .filter((p) => p.pocet >= NEJMENE_PIXELU
    && p.x2 - p.x1 >= NEJMENE_STRANA
    && p.y2 - p.y1 >= NEJMENE_STRANA)
  .sort((a, b) => b.pocet - a.pocet);

await rm(KAM, { recursive: true, force: true });
await mkdir(KAM, { recursive: true });

const nahledy = [];

for (let i = 0; i < vybrane.length; i++) {
  const p = vybrane[i];
  const left = Math.max(0, p.x1 - OKRAJ);
  const top = Math.max(0, p.y1 - OKRAJ);
  const width = Math.min(W - left, p.x2 - p.x1 + 1 + OKRAJ * 2);
  const height = Math.min(H - top, p.y2 - p.y1 + 1 + OKRAJ * 2);

  /* Výřez se skládá ručně z původních pixelů a bere jen tuhle plochu —
   * sousedům se nastaví nulová alfa. */
  const id = plochy.indexOf(p);
  const surovy = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const zdroj = ((top + y) * W + (left + x)) * 4;
      const cil = (y * width + x) * 4;
      surovy[cil] = rgba[zdroj];
      surovy[cil + 1] = rgba[zdroj + 1];
      surovy[cil + 2] = rgba[zdroj + 2];
      surovy[cil + 3] = stitek[(top + y) * W + (left + x)] === id ? rgba[zdroj + 3] : 0;
    }
  }

  const jmeno = `${String(i + 1).padStart(2, "0")}.png`;
  const vyrez = await sharp(surovy, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9, palette: true, quality: 90 }).toBuffer();
  await sharp(vyrez).toFile(`${KAM}/${jmeno}`);

  nahledy.push({ jmeno, vyrez, width, height, pocet: p.pocet });
  console.log(`${jmeno}  ${String(width).padStart(3)} x ${String(height).padStart(3)} px, ${p.pocet} pixelů barvy`);
}

/* Přehledový arch, ať se dá vybírat okem a ne podle čísel. */
const SLOUPCU = 6;
const BUNKA = 180;
const radku = Math.ceil(nahledy.length / SLOUPCU);
const vrstvy = await Promise.all(nahledy.map(async (n, i) => {
  const meritko = Math.min((BUNKA - 20) / n.width, (BUNKA - 20) / n.height, 1.6);
  const w = Math.max(1, Math.round(n.width * meritko));
  const h = Math.max(1, Math.round(n.height * meritko));
  return {
    input: await sharp(n.vyrez).resize(w, h).png().toBuffer(),
    left: (i % SLOUPCU) * BUNKA + Math.round((BUNKA - w) / 2),
    top: Math.floor(i / SLOUPCU) * BUNKA + Math.round((BUNKA - h) / 2),
  };
}));

await sharp({
  create: {
    width: SLOUPCU * BUNKA, height: radku * BUNKA,
    channels: 4, background: "#ffffff",
  },
}).composite(vrstvy).png().toFile(`${KAM}/nahled.png`);

console.log(`\ncelkem ${nahledy.length} snítek, přehled v ${KAM}/nahled.png`);
