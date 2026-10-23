/* Lisované květiny z třetího archu — ty se ponechanou barvou.
 *
 *   node scripts/kyticky3-oznameni.mjs
 *
 * Předloha je arch, který dodala Kačka: čtrnáct lisovaných akvarelových
 * květin na krémovém papíře. Oddělení pozadí je stejné jako u obou starších
 * skriptů (kyticky-oznameni.mjs, kyticky2-oznameni.mjs): papír archu se po
 * kanálech přepočítá na papír karty, průhlednost se vezme z odchylky od té
 * barvy měkkým prahem a maska se rozdělí na souvislé plochy.
 *
 * Jeden rozdíl je podstatný: barvy se NEPŘETÁČEJÍ na svatební paletu. Starší
 * archy to potřebovaly, protože měly jedovatější zeleň a fialovou, která na
 * svatbě není. Tenhle arch je sám o sobě tlumený a vybledlý jako herbář —
 * přebarvení by mu sebralo přesně to, kvůli čemu byl vybraný.
 *
 * Barva papíru se neodhaduje, měří se z rohů archu. Každý sken má jiný nádech
 * a napsaná konstanta by u dalšího archu nesedla.
 *
 * Vedle výřezů vzniká přehledový arch nahled.png, ať se dá vybírat okem. */

import sharp from "sharp";
import { mkdir, rm } from "node:fs/promises";

const PREDLOHA = "public/oznameni/nove kyticky/98e52a5889af34b6fa2cf9a3d5ad1081.jpg";
const KAM = "public/oznameni/kyticky3";

const PAPIR_KARTY = [251, 250, 248];

/* Měkký práh průhlednosti: pod DOLE je to papír, nad NAHORE plná barva.
 * Bledé okraje akvarelu jsou od papíru jen pár stupňů, takže práh musí jít
 * níž než u sytějších archů — jinak se z okvětních lístků ukousne lem. */
const DOLE = 4;
const NAHORE = 14;

/* Co je menší, je smítko nebo šum, ne kytka. */
const NEJMENE_PIXELU = 900;
const NEJMENE_STRANA = 24;

/* Kolem výřezu se nechá pár pixelů vzduchu, ať okraj nekončí přesně na tahu. */
const OKRAJ = 4;

/* Ztlumení barev. Arch je sám o sobě vybledlý, ale na kartě vedle drobného
 * textu jsou sytější kusy — korálová sasanka, fialka — pořád dost hlasité.
 * Sytost se stáhne a světlost se přitáhne k papíru, takže květina vypadá,
 * jako by v herbáři ležela o pár let déle.
 *
 * Dělá se to tady a ne přes CSS filtr schválně: filtrovaný obrázek si
 * prohlížeč při tisku přepočítá v rozlišení, které si zvolí sám. V PNG je
 * barva hotová a do tiskového PDF jde tak, jak je. */
const TLUM_SYTOST = 0.42;    // o kolik se ubere ze sytosti
const TLUM_SVETLOST = 0.22;  // o kolik se barva přiblíží bílé

function naHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, sat, l];
}

function naRgb(h, sat, l) {
  if (sat === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + sat) : l + sat - l * sat;
  const pp = 2 * l - q;
  const slozka = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return pp + (q - pp) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return pp + (q - pp) * (2 / 3 - t) * 6;
    return pp;
  };
  return [slozka(h + 1 / 3), slozka(h), slozka(h - 1 / 3)].map((v) => Math.round(v * 255));
}

function ztlum(r, g, b) {
  const [h, sat, l] = naHsl(r, g, b);
  return naRgb(h, sat * (1 - TLUM_SYTOST), l + (1 - l) * TLUM_SVETLOST);
}

const nabeh = (t) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

const { data, info } = await sharp(PREDLOHA).raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

/* Barva papíru z rohů: v každém rohu čtverec 40 x 40 px, medián přes kanál.
 * Medián, ne průměr — kdyby do rohu zasahoval kus kytky, průměr by ho vzal
 * s sebou. */
function papirZRohu() {
  const R = 40;
  const vzorky = [[], [], []];
  const rohy = [[0, 0], [W - R, 0], [0, H - R], [W - R, H - R]];
  for (const [rx, ry] of rohy) {
    for (let y = ry; y < ry + R; y++) {
      for (let x = rx; x < rx + R; x++) {
        const i = (y * W + x) * C;
        for (let c = 0; c < 3; c++) vzorky[c].push(data[i + c]);
      }
    }
  }
  return vzorky.map((v) => {
    v.sort((a, b) => a - b);
    return v[v.length >> 1];
  });
}

const PAPIR_ARCHU = papirZRohu();
console.log(`papír archu: rgb(${PAPIR_ARCHU.join(", ")})`);

const zisk = PAPIR_KARTY.map((k, i) => k / PAPIR_ARCHU[i]);

/* Vyvážený obrázek a maska průhlednosti v jednom průchodu. */
const rgba = Buffer.alloc(W * H * 4);
const alfa = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) {
  const i = p * C;
  let odchylka = 0;
  const vyvazene = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const v = Math.min(255, Math.round(data[i + c] * zisk[c]));
    vyvazene[c] = v;
    odchylka = Math.max(odchylka, Math.abs(v - PAPIR_KARTY[c]));
  }
  /* Ztlumí se až to, co je zřetelně barva. Na papíru s JPEG šumem by to
     jinak vyrobilo bledé tečky tam, kde nic není. */
  const barva = odchylka > DOLE ? ztlum(vyvazene[0], vyvazene[1], vyvazene[2]) : vyvazene;
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
const SLOUPCU = 5;
const BUNKA = 200;
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
