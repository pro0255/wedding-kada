/* Příbory k deskám menu.
 *
 *   node scripts/menu-pribory.mjs
 *
 * Předloha (public/menu/pribor.jpg) je vidlička, nůž a lžíce na bílém papíře,
 * každá s růžovou mašlí. Web je potřebuje zvlášť — vidličku nalevo od menu,
 * nůž se lžící napravo — takže se musí rozdělit, odmaskovat pozadí a mašle
 * přebarvit do modré.
 *
 * Dělí se podle prázdných sloupců: mezi příbory je na předloze čistý bílý
 * pruh, takže stačí spočítat, kolik je v každém sloupci kresby, a rozřezat to
 * tam, kde není nic. Pevné třetiny by nesedly — příbory nejsou stejně široké
 * ani rozmístěné pravidelně.
 *
 * Mašle se poznají podle sytosti: příbor je kreslený šedě, mašle je jediná
 * barevná věc na předloze. Odstín se jí nastaví na modrý a světlost se nechá,
 * takže mašli zůstanou záhyby i stíny. */

import sharp from "sharp";

const ZDROJ = "public/menu/pribor.jpg";
const CIL = "public/menu";

/* Jak se výřezy jmenují, zleva doprava. */
const NAZVY = ["vidlicka", "nuz", "lzice"];

/* Modrá mašlí — stejná jako rámeček menu. */
const ODSTIN = 207;
const SYTOST = 0.42;

/* Od jaké sytosti jde o mašli. Šedá kresba příboru se drží pod desetinou. */
const SYTOST_MASLE = 0.18;

/* Prahy tmavosti pro průhlednost. */
const PAPIR = 26;
const TAH = 120;

/* Šířka jednoho výřezu na výstupu. */
const SIRKA = 300;

const prah = (v, od, do_) => {
  const t = Math.min(1, Math.max(0, (v - od) / (do_ - od)));
  return t * t * (3 - 2 * t);
};

const naHsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
};

const naRgb = (h, s, l) => {
  h = (((h % 360) + 360) % 360) / 360;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const kanal = (tt) => {
    let t = tt;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [kanal(h + 1 / 3), kanal(h), kanal(h - 1 / 3)].map((v) => Math.round(v * 255));
};

const { data, info } = await sharp(ZDROJ).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;

/* --- průhlednost a přebarvení mašlí --- */
const alfa = new Float32Array(W * H);
const barva = Buffer.alloc(W * H * 3);
for (let p = 0; p < W * H; p++) {
  const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
  const jas = (r + g + b) / 3;
  alfa[p] = prah(255 - jas, PAPIR, TAH);
  const [, s, l] = naHsl(r, g, b);
  if (s > SYTOST_MASLE) {
    const [nr, ng, nb] = naRgb(ODSTIN, Math.min(s, SYTOST), l);
    barva[p * 3] = nr; barva[p * 3 + 1] = ng; barva[p * 3 + 2] = nb;
  } else {
    barva[p * 3] = r; barva[p * 3 + 1] = g; barva[p * 3 + 2] = b;
  }
}

/* --- rozdělení podle prázdných sloupců --- */
const vSloupci = new Int32Array(W);
for (let x = 0; x < W; x++) {
  let n = 0;
  for (let y = 0; y < H; y++) if (alfa[y * W + x] > 0.35) n++;
  vSloupci[x] = n;
}
const useky = [];
let od = -1;
for (let x = 0; x <= W; x++) {
  const je = x < W && vSloupci[x] > 0;
  if (je && od < 0) od = x;
  if (!je && od >= 0) { useky.push([od, x - 1]); od = -1; }
}
/* Drobné úlomky (odlesk, tečka po skenu) nejsou příbor. */
const prib = useky.filter(([a, b]) => b - a > W * 0.05);
console.log(`nalezeno ${prib.length} příborů: ${prib.map(([a, b]) => `${a}–${b}`).join(", ")}`);
if (prib.length !== NAZVY.length) {
  console.log(`  (čekal jsem ${NAZVY.length}; zkontroluj prahy nebo předlohu)`);
}

for (let i = 0; i < prib.length && i < NAZVY.length; i++) {
  const [x1, x2] = prib[i];
  let y1 = H, y2 = 0;
  for (let y = 0; y < H; y++) {
    for (let x = x1; x <= x2; x++) {
      if (alfa[y * W + x] > 0.35) { if (y < y1) y1 = y; if (y > y2) y2 = y; break; }
    }
  }
  const sirka = x2 - x1 + 1, vyska = y2 - y1 + 1;
  const ven = Buffer.alloc(sirka * vyska * 4);
  for (let y = 0; y < vyska; y++) {
    for (let x = 0; x < sirka; x++) {
      const p = (y + y1) * W + (x + x1), q = (y * sirka + x) * 4;
      ven[q] = barva[p * 3]; ven[q + 1] = barva[p * 3 + 1]; ven[q + 2] = barva[p * 3 + 2];
      ven[q + 3] = Math.round(255 * alfa[p]);
    }
  }
  const vysledek = await sharp(ven, { raw: { width: sirka, height: vyska, channels: 4 } })
    .resize({ width: Math.min(sirka, SIRKA) })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(`${CIL}/${NAZVY[i]}.webp`);
  console.log(`${NAZVY[i]}  ${sirka}x${vyska} → ${vysledek.width}x${vysledek.height}, ${(vysledek.size / 1024).toFixed(0)} kB, poměr ${(vysledek.height / vysledek.width).toFixed(2)}`);
}
