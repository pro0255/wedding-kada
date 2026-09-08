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
 * 3. Odstíny se srovnají na naši paletu. Arch má i barvy, které na svatbě
 *    nejsou — hlavně fialovou a jedovatější zelenou. Každý barevný pixel se
 *    proto přetočí na nejbližší paletový odstín a sytost se k němu přitáhne;
 *    světlost se skoro nechává, jinak by z akvarelu zmizelo stínování a kytky
 *    by vyšly ploché jako samolepky.
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

/* Paleta svatby — stejných sedm odstínů jako kuličky u dress code na webu. */
const PALETA = ["#c3d7ec", "#f6c396", "#f5a3a8", "#f4d3d9", "#a8c8ec", "#f8e4a3", "#b7d3ab"];

/* Jak silně se sahá na původní barvu. Odstín se přetočí celý, sytost se
 * přitáhne skoro z poloviny, světlost jen naznačí — v ní je nesené stínování. */
const TAH_SYTOST = 0.45;
const TAH_SVETLOST = 0.2;

/* Pod touhle sytostí je pixel prakticky šedý (stín, stonek v protisvětle)
 * a přebarvovat ho nemá smysl — jen by se z něj stala barevná skvrna. */
const SEDA = 0.1;

/* Pásmo listů, ve stupních. Cokoli sem spadne jde na šalvějovou, i kdyby měl
 * blíž jiný paletový odstín — olivový stonek má blíž ke krémové žluté a
 * modrozelený eukalyptus k modré, takže bez tohohle pravidla listí zežloutne
 * a eukalyptus zmodrá. Listí má zůstat listím. */
const LISTY = [55, 190];
const SALVEJ = 6; // index #b7d3ab v PALETA

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

/** Odstín na nejbližší paletový, sytost a světlost přitáhnout. */
function doPalety(r, g, b) {
  const [h, s, l] = naHsl(r, g, b);
  if (s < SEDA) return [r, g, b];

  const stupne = h * 360;
  let nejlepsi;
  if (stupne >= LISTY[0] && stupne <= LISTY[1]) {
    nejlepsi = paletaHsl[SALVEJ];
  } else {
    nejlepsi = paletaHsl[0];
    let nejmensi = 1;
    for (const c of paletaHsl) {
      const d = Math.abs(h - c[0]);
      const vzdalenost = Math.min(d, 1 - d); // odstín je kruh, 0 a 1 jsou vedle sebe
      if (vzdalenost < nejmensi) { nejmensi = vzdalenost; nejlepsi = c; }
    }
  }

  return naRgb(
    nejlepsi[0],
    s + (nejlepsi[1] - s) * TAH_SYTOST,
    l + (nejlepsi[2] - l) * TAH_SVETLOST,
  );
}

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
  const vyvazene = [0, 1, 2].map((c) => Math.min(255, Math.round(data[i + c] * zisk[c])));
  let odchylka = 0;
  for (let c = 0; c < 3; c++) odchylka = Math.max(odchylka, Math.abs(vyvazene[c] - PAPIR_KARTY[c]));

  /* Přebarvuje se až od chvíle, kdy je pixel zřetelně barva a ne papír —
   * na papíru s JPEG šumem by to jinak vyrobilo barevné tečky. */
  const barva = odchylka > DOLE ? doPalety(vyvazene[0], vyvazene[1], vyvazene[2]) : vyvazene;
  for (let c = 0; c < 3; c++) rgba[p * 4 + c] = barva[c];
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
