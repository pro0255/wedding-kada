/* Výroba bočního květinového pruhu z podkladu public/fotky/kvetiny-motyl.png.
   Spouští se ručně:  node scripts/pruh-kvetin.mjs
   Výstup: public/fotky/kvetiny-motyl-bez.jpg + public/fotky/motyl-*.png

   Proč skript a ne úprava v grafickém editoru: každý krok je měřený a
   zopakovatelný. Když se sáhne na paletu v :root nebo se vymění podklad,
   přegeneruje se to jedním příkazem místo hádání myší. */
import sharp from "sharp";
import fs from "fs";

const ZDROJ = "public/fotky/kvetiny-motyl.png";
const CIL = "public/fotky/kvetiny-motyl-bez.jpg";
const W = 600, H = 2048;          // ořez: za 46 % šířky je podklad prázdný

const BEZ = [236, 231, 222];      // --bg-alt
const SYTOST = 1.20;
const SLABA = 0.60;               // jak málo se béžovou násobí kresba (papír vždy naplno)
const TEPLO = 1.0;                // síla oteplení bílé
const TEPLO_RUZOVA = 0.30;        // růžová se otepluje míň, jinak zlososovatí
const MOTYL_SYTOST = 1.55;        // motýli letí nad květinami, potřebují víc barvy než pruh

/* Základní tvary se berou jen z modrých motýlů. Růžové předlohy byly natočené
   jinak a mávání jim sedělo hůř — tvar je tedy jeden a barvy se dodělají
   přebarvením, takže všichni létají stejně dobře. Cíle jsou odstíny z :root. */
const MOTYL_BARVY = [
  { pripona: "modry", h: null },                 // původní, beze změny
  { pripona: "ruzovy", h: 349, smax: 0.62 },     // --ruzova
  { pripona: "broskvovy", h: 28, smax: 0.58 },   // --broskev
  { pripona: "zluty", h: 46, smax: 0.52 },       // --zluta
];

/* Kam táhnout odstíny. Cíle jsou hodnoty proměnných z :root v globals.css.
   "tah" 1.0 = přesunout úplně, nižší = jen srovnat a zbytek nechat kresbě,
   ať si květy udrží vlastní tónování a nejsou z toho placky. */
const PASMA = [
  { od: 300, do: 338, cil: 353, tah: 1.00, smax: 0.55 },  // purpurová, mimo paletu
  { od: 258, do: 300, cil: 211, tah: 1.00, smax: 0.50 },  // fialová, mimo paletu
  { od: 185, do: 258, cil: 208, tah: 0.70 },              // --modra
  { od: 70, do: 185, cil: 92, tah: 0.65 },                // --palette-sage
  { od: 45, do: 70, cil: 46, tah: 0.70 },                 // --zluta
  { od: 12, do: 45, cil: 28, tah: 0.40 },                 // --broskev
  { od: 338, do: 12, cil: 349, tah: 0.60, snasob: 1.12, smax: 0.55 }, // --ruzova
];

/* Část shluků se přebarví na jinou barvu palety, ať pozadí není dvoubarevné.
   Váhy jsou schválně nízké — růžová a modrá mají pořád vést. */
const ROZDELENI = [
  {
    jm: "růžové", uvnitr: (h) => (h >= 338 || h < 12), pasmo: (h) => (h >= 330 || h <= 20),
    cile: [
      { jm: "růžová (nechat)", h: null, vaha: 74 },
      { jm: "broskvová", h: 28, smax: 0.50, vaha: 14 },
      { jm: "žlutá", h: 46, smax: 0.44, vaha: 12 },
    ],
  },
  {
    jm: "modré", uvnitr: (h) => (h >= 185 && h < 258), pasmo: (h) => (h >= 180 && h <= 265),
    cile: [
      { jm: "modrá (nechat)", h: null, vaha: 78 },
      { jm: "zelená", h: 96, smax: 0.32, vaha: 9 },
      { jm: "broskvová", h: 28, smax: 0.48, vaha: 7 },
      { jm: "žlutá", h: 46, smax: 0.44, vaha: 6 },
    ],
  },
];

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

const dilatace = (body, k) => {
  const m = new Uint8Array(W * H);
  for (const p of body) m[p] = 1;
  for (let i = 0; i < k; i++) {
    const kop = Uint8Array.from(m);
    for (let p = 0; p < W * H; p++) {
      if (kop[p]) continue;
      const x = p % W, y = (p / W) | 0;
      if ((x > 0 && kop[p - 1]) || (x < W - 1 && kop[p + 1]) || (y > 0 && kop[p - W]) || (y < H - 1 && kop[p + W])) m[p] = 1;
    }
  }
  return m;
};

const souvisle = (maska, min) => {
  const vid = new Uint8Array(W * H), bl = [];
  for (let p = 0; p < W * H; p++) {
    if (!maska[p] || vid[p]) continue;
    const q = [p]; vid[p] = 1;
    const body = [];
    let sx = 0, sy = 0, x1 = 1e9, x2 = -1, y1 = 1e9, y2 = -1;
    while (q.length) {
      const c = q.pop(), x = c % W, y = (c / W) | 0;
      body.push(c); sx += x; sy += y;
      if (x < x1) x1 = x; if (x > x2) x2 = x; if (y < y1) y1 = y; if (y > y2) y2 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const np = ny * W + nx;
        if (maska[np] && !vid[np]) { vid[np] = 1; q.push(np); }
      }
    }
    if (body.length >= min) bl.push({
      body, cx: Math.round(sx / body.length), cy: Math.round(sy / body.length),
      x1, y1, w: x2 - x1 + 1, h: y2 - y1 + 1, cnt: body.length,
    });
  }
  return bl;
};

const pasmo = (h) => PASMA.find((p) => (p.od > p.do ? (h >= p.od || h < p.do) : (h >= p.od && h < p.do)));
/* výběr podle souřadnic, ne náhodně — barvy se nekupí a přegenerování dá totéž */
const vyber = (cx, cy, cile) => {
  let v = (cx * 7919 + cy * 104729) % 100, a = 0;
  for (const c of cile) { a += c.vaha; if (v < a) return c; }
  return cile[0];
};

const { data, info } = await sharp(ZDROJ).removeAlpha()
  .extract({ left: 0, top: 0, width: W, height: H }).raw().toBuffer({ resolveWithObject: true });
const C = info.channels;
const im = Buffer.alloc(W * H * 3);
for (let p = 0; p < W * H; p++) { im[p * 3] = data[p * C]; im[p * 3 + 1] = data[p * C + 1]; im[p * 3 + 2] = data[p * C + 2]; }

/* 1. Motýli ven. Poznají se tak, že jsou to malé souvislé skvrny stojící
      samotné v prázdné ploše vpravo od hlavního pásu větví. Vyříznou se do
      vlastních PNG s průhledností a z pruhu se vymažou — nad pruhem pak
      poletují jako samostatné obrázky, viz app/Motyli.tsx. */
const kresba = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) if (Math.min(im[p * 3], im[p * 3 + 1], im[p * 3 + 2]) < 247) kresba[p] = 1;
const motyli = souvisle(kresba, 120)
  .filter((b) => b.cnt <= 6000 && b.w <= 110 && b.h <= 110 && b.x1 > 150)
  .sort((a, b) => a.y1 - b.y1);

/* Ze šesti nalezených se použijí jen modří — poznají se podle odstínu kolem
   219°. Z každého se pak vyrobí všechny barvy z MOTYL_BARVY. */
const modri = motyli.filter((b) => {
  let cx = 0, cy = 0, n = 0;
  for (const p of b.body) {
    const [h, sat] = rgb2hsl(im[p * 3], im[p * 3 + 1], im[p * 3 + 2]);
    if (sat < 0.12) continue;
    cx += Math.cos(h * Math.PI / 180); cy += Math.sin(h * Math.PI / 180); n++;
  }
  if (!n) return false;
  const h = ((Math.atan2(cy, cx) * 180 / Math.PI) + 360) % 360;
  return h > 180 && h < 260;
});

for (let i = 0; i < modri.length; i++) {
  const b = modri[i], O = 4;
  const x0 = Math.max(0, b.x1 - O), y0 = Math.max(0, b.y1 - O);
  const w = Math.min(W - x0, b.w + O * 2), h = Math.min(H - y0, b.h + O * 2);
  for (const barva of MOTYL_BARVY) {
    const rgba = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = (y0 + y) * W + (x0 + x), o = (y * w + x) * 4;
      let r = im[p * 3], g = im[p * 3 + 1], bb = im[p * 3 + 2];
      if (barva.h !== null) {
        const [hh, ss, ll] = rgb2hsl(r, g, bb);
        /* Přebarvuje se jen modrá plocha křídel. Tmavé tělo a tykadla mají
           nízkou sytost nebo jiný odstín a zůstávají — jinak by motýl přišel
           o kresbu a byl by z něj barevný flek. */
        if (ss >= 0.12 && hh > 175 && hh < 265) {
          const d = hh - 219;
          [r, g, bb] = hsl2rgb(barva.h + d * 0.35, Math.min(ss, barva.smax), ll);
        }
      }
      rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = bb;
      /* průhlednost z toho, jak daleko je pixel od bílého papíru */
      rgba[o + 3] = Math.max(0, Math.min(255, Math.round((255 - Math.min(r, g, bb)) * 255 / 45)));
    }
    await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
      .modulate({ saturation: MOTYL_SYTOST }).png()
      .toFile(`public/fotky/motyl-${barva.pripona}-${i + 1}.png`);
  }
}
console.log(`z ${motyli.length} nalezených je ${modri.length} modrých`
  + ` → ${modri.length * MOTYL_BARVY.length} obrázků ve ${MOTYL_BARVY.length} barvách`);
for (const b of motyli) {
  for (let y = b.y1 - 2; y < b.y1 + b.h + 2; y++) for (let x = b.x1 - 2; x < b.x1 + b.w + 2; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const p = y * W + x; im[p * 3] = im[p * 3 + 1] = im[p * 3 + 2] = 255;
  }
}

/* Tři motýli navíc, které detekce výš minout musela: nesedí samotní v prázdné
   ploše, ale dotýkají se větví, takže splynuli do jednoho obřího souvislého
   shluku a neprošli velikostí. Našly je až šablony podle TVARU (stejný motýl
   je v předloze použitý víckrát, jen pokaždé jinak vybarvený) a každý je
   ověřený okem — porovnání tvaru hlásilo patnáct míst, ale devět z nich byly
   květy a modré snítky s podobnou siluetou.

   Nejdřív se zkoušelo mazat maskou vzorového motýla, aby se neodřízly větve
   za jeho zády. Nefunguje to: nejlepší překryv vyšel 64 % (vzor sám na sobě
   dá 100 %) a ani doladění polohy v okolí šestnácti pixelů to nezlepšilo,
   takže to nejsou kopie jednoho razítka, ale pokaždé jiný motýl. Maska mu
   ukousla půlku a zbytek nechala. Jde se tedy obdélníkem — za motýlem vede
   jen tenká větvička a zářez v ní je míň nápadný než nehybný motýl. */
const NAVIC = [
  { x: 188, y: 698, w: 54, h: 58 },
  { x: 216, y: 1316, w: 54, h: 58 },
  { x: 173, y: 1956, w: 54, h: 58 },
];
let smazano = 0;
for (const n of NAVIC) {
  for (let y = n.y; y < n.y + n.h; y++) for (let x = n.x; x < n.x + n.w; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const p = y * W + x; im[p * 3] = im[p * 3 + 1] = im[p * 3 + 2] = 255; smazano++;
  }
}
console.log(`motýli navíc: ${NAVIC.length} smazáno maskou tvaru (${smazano} px)`);
console.log(`motýli: ${motyli.length} vyříznuti a vymazáni z pruhu`);

/* 2. Přerozdělení části shluků na další barvy palety. */
const hotovo = new Uint8Array(W * H);
for (const u of ROZDELENI) {
  const m = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    const [h, s, l] = rgb2hsl(im[p * 3], im[p * 3 + 1], im[p * 3 + 2]);
    if (s >= 0.12 && l <= 0.94 && u.uvnitr(h)) m[p] = 1;
  }
  const bl = souvisle(m, 60), pocet = {};
  for (const b of bl) {
    const cil = vyber(b.cx, b.cy, u.cile);
    pocet[cil.jm] = (pocet[cil.jm] || 0) + 1;
    if (cil.h === null) continue;
    const maska = dilatace(b.body, 3);
    let sx = 0, sy = 0;
    for (const p of b.body) {
      const [h] = rgb2hsl(im[p * 3], im[p * 3 + 1], im[p * 3 + 2]);
      sx += Math.cos(h * Math.PI / 180); sy += Math.sin(h * Math.PI / 180);
    }
    const hSt = ((Math.atan2(sy, sx) * 180 / Math.PI) + 360) % 360;
    for (let p = 0; p < W * H; p++) {
      if (!maska[p] || hotovo[p]) continue;
      const [h, s, l] = rgb2hsl(im[p * 3], im[p * 3 + 1], im[p * 3 + 2]);
      if (s < 0.10 || l > 0.96 || !u.pasmo(h)) continue;
      let d = h - hSt; while (d > 180) d -= 360; while (d < -180) d += 360;
      const [nr, ng, nb] = hsl2rgb(cil.h + d * 0.30, Math.min(s, cil.smax), l);
      im[p * 3] = nr; im[p * 3 + 1] = ng; im[p * 3 + 2] = nb; hotovo[p] = 1;
    }
  }
  console.log(`${u.jm} (${bl.length}): ` + u.cile.map((c) => `${c.jm} ${pocet[c.jm] || 0}`).join(", "));
}

/* 3. Zbytek srovnat na paletu. */
for (let p = 0; p < W * H; p++) {
  if (hotovo[p]) continue;
  const [h, s, l] = rgb2hsl(im[p * 3], im[p * 3 + 1], im[p * 3 + 2]);
  if (s < 0.08 || l > 0.96) continue;
  const z = pasmo(h); if (!z) continue;
  let d = z.cil - h; while (d > 180) d -= 360; while (d < -180) d += 360;
  let ns = z.snasob ? s * z.snasob : s;
  if (z.smax) ns = Math.min(ns, z.smax);
  const [nr, ng, nb] = hsl2rgb(h + d * z.tah, ns, l);
  im[p * 3] = nr; im[p * 3 + 1] = ng; im[p * 3 + 2] = nb;
}

/* 4. Sytost, oteplení a obarvení papíru.
      Obarvení NENÍ prosté pronásobení béžovou — to ztlumí i světla a celý
      obrázek pak vypadá jako vybledlá pohlednice. Multiplikátor je pro každý
      pixel jiný: papír naplno, plná kresba jen ze SLABA. Oteplení má taky váhu
      podle kresby, aby papír zůstal čistě bílý a trefil se přesně na --bg-alt. */
const past = await sharp(im, { raw: { width: W, height: H, channels: 3 } })
  .modulate({ saturation: SYTOST }).raw().toBuffer({ resolveWithObject: true });
const out = Buffer.alloc(W * H * 3);
for (let i = 0, o = 0; i < past.data.length; i += past.info.channels, o += 3) {
  let r = past.data[i], g = past.data[i + 1], b = past.data[i + 2];
  const a = Math.min(1, (255 - Math.min(r, g, b)) / 60);
  const [h] = rgb2hsl(r, g, b);
  const t = a * TEPLO * ((h >= 325 || h <= 20) ? TEPLO_RUZOVA : 1);
  r = Math.min(255, r * (1 + 0.055 * t));
  g = Math.min(255, g * (1 + 0.012 * t));
  b = b * (1 - 0.065 * t);
  const k = a * SLABA;
  out[o] = Math.round(r / 255 * (BEZ[0] + (255 - BEZ[0]) * k));
  out[o + 1] = Math.round(g / 255 * (BEZ[1] + (255 - BEZ[1]) * k));
  out[o + 2] = Math.round(b / 255 * (BEZ[2] + (255 - BEZ[2]) * k));
}
await sharp(out, { raw: { width: W, height: H, channels: 3 } })
  .jpeg({ quality: 88, chromaSubsampling: "4:4:4" }).toFile(CIL);

const k = await sharp(CIL).raw().toBuffer();
let svetlejsi = 0;
for (let i = 0; i < k.length; i += 3) if (k[i] > 246 && k[i + 1] > 244 && k[i + 2] > 240) svetlejsi++;
const rohIdx = ((H >> 1) * W + W - 5) * 3;
console.log(`hotovo ${W}x${H} | poměr v/s ${(H / W).toFixed(3)} | ${Math.round(fs.statSync(CIL).size / 1024)} kB`);
console.log(`prázdný okraj ${[k[rohIdx], k[rohIdx + 1], k[rohIdx + 2]]} (cíl ${BEZ}) | světlejších než béžová ${(svetlejsi / (W * H) * 100).toFixed(2)} %`);
