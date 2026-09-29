/* Lisované květiny z druhého archu, i s barevnými variantami.
 *
 *   node scripts/kyticky2-oznameni.mjs
 *
 * Předloha je public/fotky/oznámení/kytičky 2.jpg — asi patnáct větších
 * lisovaných květin na krémovém papíře. Na rozdíl od prvního archu jsou tyhle
 * velké a výrazné, takže se hodí na úzký boční pruh webu, kde se drobné snítky
 * scvrknou do neurčité kaše.
 *
 * Oddělení pozadí je stejné jako u scripts/kyticky-oznameni.mjs: papír archu se
 * po kanálech přepočítá na podklad, průhlednost se bere z odchylky od té barvy
 * měkkým prahem a maska se rozdělí na souvislé plochy. Barvy se schválně
 * nepřepočítávají přes „un-multiply“ — u akvarelu z toho vyjde neon.
 *
 * Navíc se z každé květiny dělají barevné varianty. Předloha je hlavně modrá,
 * růžová a fialová; varianty přetáčejí odstín květu na další barvy z naší
 * palety, takže je pruh pestřejší a fialová, která na svatbě není, zmizí.
 * Listy a stonky se nepřebarvují nikdy — pásmo listů jde vždycky na šalvějovou,
 * jinak by olivový stonek zežloutl spolu s květem. */

import sharp from "sharp";
import { mkdir, rm } from "node:fs/promises";

const PREDLOHA = "public/fotky/oznámení/kytičky 2.jpg";
const KAM = "public/oznameni/kyticky2";

/* Paleta svatby — stejných sedm odstínů jako kuličky u dress code na webu. */
const PALETA = ["#c3d7ec", "#f6c396", "#f5a3a8", "#f4d3d9", "#a8c8ec", "#f8e4a3", "#b7d3ab"];

/* Na které odstíny se květy přetáčejí. Šalvějová v seznamu není: je to barva
 * listí, květ v ní zmizí. */
const VARIANTY = [0, 1, 2, 5];   // světle modrá, broskvová, růžová, krémově žlutá

const TAH_SYTOST = 0.5;
const TAH_SVETLOST = 0.18;

/* Pod touhle sytostí je pixel prakticky šedý a přebarvovat ho nemá smysl. */
const SEDA = 0.1;

/* Pásmo listů ve stupních — cokoli sem spadne zůstane zelené. */
const LISTY = [55, 190];
const SALVEJ = 6;

const PAPIR_ARCHU = [255, 252, 247];
const PODKLAD = [236, 231, 222];   // --bg-alt, na něj se pruh skládá

/* Měkký práh průhlednosti: pod DOLE je to papír, nad NAHORE plná barva. */
const DOLE = 6;
const NAHORE = 18;

/* Co je menší, je smítko nebo šum, ne kytka. */
const NEJMENE_PIXELU = 1200;
const NEJMENE_STRANA = 30;
const OKRAJ = 4;

function naHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function naRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const slozka = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [slozka(h + 1 / 3), slozka(h), slozka(h - 1 / 3)].map((v) => Math.round(v * 255));
}

const paletaHsl = PALETA.map((hex) => naHsl(
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
));

/** Přetočí květ na daný paletový odstín; listy nechá zelené. */
function prebarvi(r, g, b, cil) {
  const [h, s, l] = naHsl(r, g, b);
  if (s < SEDA) return [r, g, b];
  const jeList = h * 360 >= LISTY[0] && h * 360 <= LISTY[1];
  const c = paletaHsl[jeList ? SALVEJ : cil];
  return naRgb(c[0], s + (c[1] - s) * TAH_SYTOST, l + (c[2] - l) * TAH_SVETLOST);
}

const { data, info } = await sharp(PREDLOHA).raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

const zisk = PODKLAD.map((k, i) => k / PAPIR_ARCHU[i]);

/* Vyvážený obrázek a maska průhlednosti v jednom průchodu. */
const rgba = Buffer.alloc(W * H * 4);
const alfa = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) {
  const i = p * C;
  let odchylka = 0;
  for (let c = 0; c < 3; c++) {
    const v = Math.min(255, Math.round(data[i + c] * zisk[c]));
    rgba[p * 4 + c] = v;
    odchylka = Math.max(odchylka, Math.abs(v - PODKLAD[c]));
  }
  const a = Math.round(255 * Math.min(1, Math.max(0, (odchylka - DOLE) / (NAHORE - DOLE))) ** 1);
  rgba[p * 4 + 3] = a;
  alfa[p] = a;
}

/* Souvislé plochy. Iterativní zásobník, ne rekurze. */
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
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const q = ny * W + nx;
        if (stitek[q] !== -1 || alfa[q] < PRAH_MASKY) continue;
        stitek[q] = id;
        zasobnik[vrchol++] = q;
      }
    }
  }
  plochy.push({ id, pocet, x1, y1, x2, y2 });
}

const vybrane = plochy
  .filter((p) => p.pocet >= NEJMENE_PIXELU
    && p.x2 - p.x1 >= NEJMENE_STRANA
    && p.y2 - p.y1 >= NEJMENE_STRANA)
  .sort((a, b) => b.pocet - a.pocet);

await rm(KAM, { recursive: true, force: true });
await mkdir(KAM, { recursive: true });

const nahledy = [];

for (let n = 0; n < vybrane.length; n++) {
  const p = vybrane[n];
  const left = Math.max(0, p.x1 - OKRAJ);
  const top = Math.max(0, p.y1 - OKRAJ);
  const width = Math.min(W - left, p.x2 - p.x1 + 1 + OKRAJ * 2);
  const height = Math.min(H - top, p.y2 - p.y1 + 1 + OKRAJ * 2);

  /* Do výřezu jde jen tahle plocha; sousedům se nastaví nulová alfa, jinak by
   * u květiny visel utržený kus té vedlejší. */
  const cisty = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const zdroj = ((top + y) * W + (left + x)) * 4;
      const cil = (y * width + x) * 4;
      const patri = stitek[(top + y) * W + (left + x)] === p.id;
      cisty[cil] = rgba[zdroj];
      cisty[cil + 1] = rgba[zdroj + 1];
      cisty[cil + 2] = rgba[zdroj + 2];
      cisty[cil + 3] = patri ? rgba[zdroj + 3] : 0;
    }
  }

  /* Původní barva a k ní varianty přetočené na paletu. */
  const cislo = String(n + 1).padStart(2, "0");
  const kusy = [{ pripona: "a", data: cisty }];

  for (let v = 0; v < VARIANTY.length; v++) {
    const varianta = Buffer.from(cisty);
    for (let q = 0; q < width * height; q++) {
      if (varianta[q * 4 + 3] === 0) continue;
      const [r, g, b] = prebarvi(varianta[q * 4], varianta[q * 4 + 1], varianta[q * 4 + 2], VARIANTY[v]);
      varianta[q * 4] = r; varianta[q * 4 + 1] = g; varianta[q * 4 + 2] = b;
    }
    kusy.push({ pripona: "bcde"[v], data: varianta });
  }

  for (const kus of kusy) {
    const jmeno = `${cislo}${kus.pripona}.png`;
    const png = await sharp(kus.data, { raw: { width, height, channels: 4 } })
      .png({ compressionLevel: 9, palette: true, quality: 90 })
      .toBuffer();
    await sharp(png).toFile(`${KAM}/${jmeno}`);
    nahledy.push({ jmeno, png, width, height });
  }

  console.log(`${cislo}  ${String(width).padStart(3)} x ${String(height).padStart(3)} px, ${p.pocet} pixelů barvy, ${kusy.length} variant`);
}

/* Přehledový arch, ať se dá vybírat okem. */
const SLOUPCU = VARIANTY.length + 1;
const BUNKA = 190;
const radku = Math.ceil(nahledy.length / SLOUPCU);
const vrstvy = await Promise.all(nahledy.map(async (nh, i) => {
  const meritko = Math.min((BUNKA - 16) / nh.width, (BUNKA - 16) / nh.height, 1.4);
  const w = Math.max(1, Math.round(nh.width * meritko));
  const h = Math.max(1, Math.round(nh.height * meritko));
  return {
    input: await sharp(nh.png).resize(w, h).png().toBuffer(),
    left: (i % SLOUPCU) * BUNKA + Math.round((BUNKA - w) / 2),
    top: Math.floor(i / SLOUPCU) * BUNKA + Math.round((BUNKA - h) / 2),
  };
}));

await sharp({
  create: { width: SLOUPCU * BUNKA, height: radku * BUNKA, channels: 4, background: "#ece7de" },
}).composite(vrstvy).png().toFile(`${KAM}/nahled.png`);

console.log(`\ncelkem ${nahledy.length} kusů (${vybrane.length} květin x ${VARIANTY.length + 1} barev), přehled v ${KAM}/nahled.png`);
