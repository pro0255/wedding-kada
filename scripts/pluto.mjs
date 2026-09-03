/* Pluto s kyticí pro odpověď „Co si přejete za dar?".
   Spouští se ručně:  node scripts/pluto.mjs
   Vstup:  public/fotky/pluto 1.png   (kresba na plné šedé 148,148,148)
   Výstup: public/fotky/pluto-kytice.png

   Tři věci, které předloha potřebuje:
   1. Pryč šedé pozadí — není to průhlednost, je to plná barva přes 94 % plochy.
   2. Ořez na psa. Kresba zabírá jen 441 x 473 px z 1152 x 2048.
   3. Kytice do palety. V originále je purpurová a fialová, ani jedna z nich
      v :root není. */
import sharp from "sharp";
import fs from "fs";

const ZDROJ = "public/fotky/pluto 1.png";
const CIL = "public/fotky/pluto-kytice.png";
const SEDA = 148;          // barva pozadí předlohy
const TOL = 16;            // co ještě považovat za pozadí
const OKRAJ = 10;          // vzduch kolem psa v px

/* Barvy kytice. Jsou to celé hodnoty z :root, ne jen odstíny — samotný posun
   odstínu nestačil: růže zůstaly na světlosti 0.59, kdežto paleta leží mezi
   0.72 a 0.89, takže vypadaly jako tmavá vínová a ne jako vaše růžová.
   Táhne se proto i světlost a sytost.

   Každý květ dostane jednu barvu celý (hledají se souvislé skvrny), ne pixel
   po pixelu — jinak by z toho byla duha uvnitř jedné růže. */
const PALETA = [
  { jm: "růžová   --ruzova  #f4d3d9", h: 349, s: 0.60, l: 0.86, vaha: 30 },
  { jm: "modrá    --modra   #c3d7ec", h: 211, s: 0.52, l: 0.84, vaha: 26 },
  { jm: "broskvová --broskev #f6c396", h: 28, s: 0.72, l: 0.79, vaha: 24 },
  { jm: "žlutá    --zluta   #f8e4a3", h: 46, s: 0.74, l: 0.82, vaha: 20 },
];
/* jak silně se pixel přitáhne k cíli; zbytek nechává vlastní stínování květu */
const TAH_ODSTIN = 1.0, TAH_SYTOST = 0.65, TAH_SVETLOST = 0.62;
/* co se považuje za květ kytice: purpurová a fialová z předlohy */
const JE_KVET = (h, s) => s >= 0.12 && h >= 246 && h < 346;

const rgb2hsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? ((b - r) / d + 2) : ((r - g) / d + 4);
    h *= 60;
  }
  return [h, s, l];
};
const hsl2rgb = (h, s, l) => {
  h = ((h % 360) + 360) % 360 / 360;
  if (s <= 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 0.5) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(f(h + 1 / 3) * 255), Math.round(f(h) * 255), Math.round(f(h - 1 / 3) * 255)];
};

const { data, info } = await sharp(ZDROJ).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;
const pozadi = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  return Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && Math.abs(r - SEDA) < TOL;
};

let x1 = W, x2 = 0, y1 = H, y2 = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (pozadi((y * W + x) * C)) continue;
  if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y;
}
x1 = Math.max(0, x1 - OKRAJ); y1 = Math.max(0, y1 - OKRAJ);
x2 = Math.min(W - 1, x2 + OKRAJ); y2 = Math.min(H - 1, y2 + OKRAJ);
const w = x2 - x1 + 1, h = y2 - y1 + 1;

const out = Buffer.alloc(w * h * 4);
const pocet = {};
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = ((y1 + y) * W + (x1 + x)) * C, o = (y * w + x) * 4;
  let r = data[i], g = data[i + 1], b = data[i + 2];

  /* Průhlednost: čím dál je pixel od šedé pozadí, tím krytější. Plynulý
     přechod místo tvrdé prahové hodnoty drží měkké okraje akvarelu. */
  const odSede = Math.max(Math.abs(r - SEDA), Math.abs(g - SEDA), Math.abs(b - SEDA));
  let a = Math.min(255, Math.round(odSede * 255 / 26));

  const [hh, ss, ll] = rgb2hsl(r, g, b);
  /* Bílý flek za kyticí. Není to pozadí předlohy, takže by na béžové stránce
     zůstal svítit jako záplata — proto se z bílé stává průhledno. Světlá srst
     psa má vždycky aspoň trochu barvy, ta projde. */
  if (ll > 0.90 && ss < 0.14) a = Math.round(a * Math.max(0, (0.97 - ll) / 0.07));

  out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
}

/* Květy kytice: najdou se souvislé skvrny a každá dostane jednu barvu palety.
   Rozděluje se podle souřadnic středu, ne náhodně — přegenerování dá totéž. */
const kvet = new Uint8Array(w * h);
for (let p = 0; p < w * h; p++) {
  if (out[p * 4 + 3] < 40) continue;
  const [hh, ss] = rgb2hsl(out[p * 4], out[p * 4 + 1], out[p * 4 + 2]);
  if (JE_KVET(hh, ss)) kvet[p] = 1;
}
/* Růže se v předloze dotýkají a jako souvislé skvrny splynou do pár chomáčů —
   naměřeno 8 na celou kytici, takže by se obarvila po velkých blocích. Maska
   se proto nejdřív zúží o EROZE pixelů, čímž se tenké spoje mezi květy přetrhnou
   a každý dostane vlastní jádro. Zbytek kytice se pak k jádrům přiřadí růstem
   do šířky (kdo je blíž, ten bere), takže žádný květ nezůstane napůl. */
const EROZE = 3;
let jadra = Uint8Array.from(kvet);
for (let k = 0; k < EROZE; k++) {
  const kop = Uint8Array.from(jadra);
  for (let p = 0; p < w * h; p++) {
    if (!kop[p]) continue;
    const x = p % w, y = (p / w) | 0;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1
      || !kop[p - 1] || !kop[p + 1] || !kop[p - w] || !kop[p + w]) jadra[p] = 0;
  }
}
const stitek = new Int32Array(w * h).fill(-1);
const skvrny = [];
for (let p = 0; p < w * h; p++) {
  if (!jadra[p] || stitek[p] >= 0) continue;
  const id = skvrny.length;
  const q = [p]; stitek[p] = id;
  const body = []; let sx = 0, sy = 0;
  while (q.length) {
    const c = q.pop(), x = c % w, y = (c / w) | 0;
    body.push(c); sx += x; sy += y;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (jadra[np] && stitek[np] < 0) { stitek[np] = id; q.push(np); }
    }
  }
  if (body.length >= 12) skvrny.push({ body, cx: Math.round(sx / body.length), cy: Math.round(sy / body.length) });
  else for (const c of body) stitek[c] = -1;
}
/* růst jader do zbytku kytice */
let fronta = [];
for (let p = 0; p < w * h; p++) if (stitek[p] >= 0) fronta.push(p);
while (fronta.length) {
  const dalsi = [];
  for (const c of fronta) {
    const x = c % w, y = (c / w) | 0, id = stitek[c];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const np = ny * w + nx;
      if (kvet[np] && stitek[np] < 0) { stitek[np] = id; skvrny[id].body.push(np); dalsi.push(np); }
    }
  }
  fronta = dalsi;
}

const vyber = (cx, cy) => {
  let v = (cx * 7919 + cy * 104729) % 100, a = 0;
  for (const c of PALETA) { a += c.vaha; if (v < a) return c; }
  return PALETA[0];
};
const mix = (a, b, t) => a + (b - a) * t;

for (const s of skvrny) {
  const cil = vyber(s.cx, s.cy);
  pocet[cil.jm] = (pocet[cil.jm] || 0) + 1;
  /* kruhový průměr odstínu skvrny, aby se odchylky měřily od jejího středu */
  let ax = 0, ay = 0;
  for (const p of s.body) {
    const [hh] = rgb2hsl(out[p * 4], out[p * 4 + 1], out[p * 4 + 2]);
    ax += Math.cos(hh * Math.PI / 180); ay += Math.sin(hh * Math.PI / 180);
  }
  const hSt = ((Math.atan2(ay, ax) * 180 / Math.PI) + 360) % 360;
  for (const p of s.body) {
    const [hh, ss, ll] = rgb2hsl(out[p * 4], out[p * 4 + 1], out[p * 4 + 2]);
    let d = hh - hSt; while (d > 180) d -= 360; while (d < -180) d += 360;
    const [nr, ng, nb] = hsl2rgb(
      cil.h + d * (1 - TAH_ODSTIN) + d * 0.30,
      mix(ss, cil.s, TAH_SYTOST),
      mix(ll, cil.l, TAH_SVETLOST),
    );
    out[p * 4] = nr; out[p * 4 + 1] = ng; out[p * 4 + 2] = nb;
  }
}
console.log(`květů v kytici: ${skvrny.length}`);

/* Na stránce je vysoký kolem 120 px, na displeji s dvojnásobnou hustotou tedy
   240 px. 320 px dává rezervu a přitom srazí soubor z 301 kB na zlomek. */
await sharp(out, { raw: { width: w, height: h, channels: 4 } })
  .resize({ width: 320 }).png({ compressionLevel: 9, palette: true }).toFile(CIL);

const kon = await sharp(CIL).raw().toBuffer({ resolveWithObject: true });
let sede = 0, kryci = 0, mimo = 0;
for (let i = 0; i < kon.data.length; i += 4) {
  if (kon.data[i + 3] < 128) continue;
  kryci++;
  const [hh, ss] = rgb2hsl(kon.data[i], kon.data[i + 1], kon.data[i + 2]);
  if (Math.abs(kon.data[i] - SEDA) < TOL && ss < 0.10) sede++;
  if (JE_KVET(hh, ss)) mimo++;
}
console.log(`ořez ${w}x${h} (z ${W}x${H}) | poměr v/š ${(h / w).toFixed(3)} | ${Math.round(fs.statSync(CIL).size / 1024)} kB`);
Object.entries(pocet).forEach(([k, v]) => console.log(`  ${k}: ${v} px`));
console.log(`krycích pixelů ${kryci} | zbytek šedé ${sede} | nepřebarvená purpurová/fialová ${mimo}`);

/* kontrola, jestli kytice opravdu sedí na paletu */
let cx = 0, cy = 0, ss2 = 0, ll2 = 0, n2 = 0;
for (let i = 0; i < kon.data.length; i += 4) {
  if (kon.data[i + 3] < 150) continue;
  const [hh, ss, ll] = rgb2hsl(kon.data[i], kon.data[i + 1], kon.data[i + 2]);
  if (ss < 0.15 || !(hh >= 320 || hh < 20)) continue;
  cx += Math.cos(hh * Math.PI / 180); cy += Math.sin(hh * Math.PI / 180); ss2 += ss; ll2 += ll; n2++;
}
console.log(`růžové květy: h=${(((Math.atan2(cy, cx) * 180 / Math.PI) + 360) % 360).toFixed(0)}`
  + ` s=${(ss2 / n2).toFixed(2)} l=${(ll2 / n2).toFixed(2)}  (paleta: l 0.72-0.89)`);
