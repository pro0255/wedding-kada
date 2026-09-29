/* Deska svatebního menu z fotky.
 *
 *   node scripts/menu-deska.mjs
 *
 * Z fotky zavřeného menu (public/menu) udělá prázdnou baby blue desku, na
 * kterou si web dopíše vlastní zlatý název. Web ji používá třikrát: na líc
 * obálky, na její rub a na pravou desku rozevřeného menu.
 *
 * Fotka má dvě věci navíc, které musí pryč: cizí potisk (talíř, „Menu“ a řecký
 * nápis) a krémovou barvu. Ostrý diagonální stín přes desku naopak zůstává —
 * právě ten dělá, že deska vypadá jako vyfocená, a ne jako obdélník.
 *
 * Potisk se hledá v rozdílu modrého a červeného kanálu: papír je krémový
 * a vychází záporně, papír ve stínu lehce kladně, modrý inkoust hluboko
 * kladně. Sytost by tu neposloužila — u tak světlé barvy vyjde i z pár jednotek
 * rozdílu mezi kanály sytost přes dvacet procent a maska by sebrala celou
 * desku.
 *
 * Zacelit potisk průměrem okolí nejde jen tak: kresba talíře leží přesně na
 * hraně stínu, takže by se do průměru míchal osvětlený papír se stínem a místo
 * kresby by zbyla blátivá šmouha. Hrana stínu je ale rovná, takže se dá
 * proložit přímkou a podle ní se každý pixel zařadí na jednu, nebo druhou
 * stranu. Pak se počítají dva průměry — jeden ze světlého papíru, druhý ze
 * stínového — a každý chybějící pixel si vezme ten svůj. Stín tím pokračuje
 * kresbou dál, jako by tam nikdy nic natištěného nebylo. */

import sharp from "sharp";

const ZDROJ = "public/menu/zavřené menu.jpg";
const CIL = "public/menu/deska.webp";

/* Deska na fotce, pár pixelů dovnitř od hrany — fotka je nepatrně
 * perspektivní a hrana není na všech řádcích stejně daleko. */
const DESKA = { left: 292, top: 116, width: 476, height: 672 };

/* Baby blue desek. */
const ODSTIN = 207;
const SYTOST = 0.32;

/* O kolik musí být modrý kanál silnější než červený, aby šlo o potisk. Nízko
 * schválně: světlejší místa kresby jsou modrá jen mírně a při vyšším prahu po
 * nich zůstával duch. */
const MODROST_INKOUSTU = 20;

/* Práh mezi stínem a světlem. Papír na světle má kolem 235, ve stínu 115. */
const PRAH_STINU = 175;

/* Z jak velkého okolí se bere náhrada za smazaný potisk. Musí přesáhnout
 * největší kresbu — uvnitř talíře není blízko žádný čistý papír. */
const ZAPLATA = 150;

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

const { data, info } = await sharp(ZDROJ)
  .extract(DESKA)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;

/* --- kde je potisk --- */
const inkoust = new Uint8Array(W * H);
let pocetInkoustu = 0;
for (let p = 0; p < W * H; p++) {
  if (data[p * 4 + 2] - data[p * 4] > MODROST_INKOUSTU) { inkoust[p] = 1; pocetInkoustu++; }
}
/* Rozšíření masky — kolem tahu je lem, který prahem neprojde, ale barvu už má
 * potaženou. */
const LEM = 6;
const maska = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let je = 0;
    for (let dy = -LEM; dy <= LEM && !je; dy++) {
      for (let dx = -LEM; dx <= LEM; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (inkoust[ny * W + nx]) { je = 1; break; }
      }
    }
    maska[y * W + x] = je;
  }
}

/* --- hrana stínu jako přímka --- */
/* Na každém řádku se hledá jediný přechod mezi světlým a stínovým papírem.
 * Řádky, kde přechodů není právě jeden, se přeskakují — ty vedou přes potisk
 * a ukazovaly by jinam. */
const svetlost = new Float64Array(W * H);
for (let p = 0; p < W * H; p++) {
  svetlost[p] = (data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2]) / 3;
}
const body = [];
for (let y = 0; y < H; y++) {
  let prechod = -1, kolik = 0, predchozi = null;
  for (let x = 0; x < W; x++) {
    if (maska[y * W + x]) { predchozi = null; continue; }
    const stin = svetlost[y * W + x] < PRAH_STINU ? 1 : 0;
    if (predchozi !== null && stin !== predchozi) { prechod = x; kolik++; }
    predchozi = stin;
  }
  if (kolik === 1) body.push([y, prechod]);
}

/* Nejmenší čtverce: x = a·y + b. */
let a = 0, b = W / 2;
if (body.length > 20) {
  const n = body.length;
  const sy = body.reduce((s, [y]) => s + y, 0);
  const sx = body.reduce((s, [, x]) => s + x, 0);
  const syy = body.reduce((s, [y]) => s + y * y, 0);
  const sxy = body.reduce((s, [y, x]) => s + y * x, 0);
  a = (n * sxy - sy * sx) / (n * syy - sy * sy);
  b = (sx - a * sy) / n;
}
console.log(`  hrana stínu proložena z ${body.length} řádků: x = ${a.toFixed(3)}·y + ${b.toFixed(0)}`);

/* Která strana přímky je stín — rozhodne průměr papíru na obou stranách. */
let sumaVlevo = 0, nVlevo = 0, sumaVpravo = 0, nVpravo = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (maska[y * W + x]) continue;
    if (x < a * y + b) { sumaVlevo += svetlost[y * W + x]; nVlevo++; }
    else { sumaVpravo += svetlost[y * W + x]; nVpravo++; }
  }
}
const stinVlevo = (sumaVlevo / Math.max(1, nVlevo)) < (sumaVpravo / Math.max(1, nVpravo));
const strana = new Uint8Array(W * H);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    strana[y * W + x] = ((x < a * y + b) === stinVlevo) ? 1 : 0;
  }
}

/* --- náhrada za potisk: průměr papíru na téže straně hrany --- */
/* Centrované okno počítané z předpočítaných součtů, aby cena nerostla
 * s poloměrem. Jednostranné okno by průměr posunulo o svůj poloměr. */
function prumerStrany(kanal, chtenaStrana, r) {
  const radekS = new Float64Array(W * H), radekV = new Float64Array(W * H);
  for (let y = 0; y < H; y++) {
    const s = new Float64Array(W + 1), v = new Float64Array(W + 1);
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const platny = !maska[p] && strana[p] === chtenaStrana ? 1 : 0;
      s[x + 1] = s[x] + (platny ? kanal[p] : 0);
      v[x + 1] = v[x] + platny;
    }
    for (let x = 0; x < W; x++) {
      const od = Math.max(0, x - r), doo = Math.min(W - 1, x + r);
      radekS[y * W + x] = s[doo + 1] - s[od];
      radekV[y * W + x] = v[doo + 1] - v[od];
    }
  }
  const ven = new Float64Array(W * H);
  for (let x = 0; x < W; x++) {
    const s = new Float64Array(H + 1), v = new Float64Array(H + 1);
    for (let y = 0; y < H; y++) {
      s[y + 1] = s[y] + radekS[y * W + x];
      v[y + 1] = v[y] + radekV[y * W + x];
    }
    for (let y = 0; y < H; y++) {
      const od = Math.max(0, y - r), doo = Math.min(H - 1, y + r);
      const su = s[doo + 1] - s[od], va = v[doo + 1] - v[od];
      ven[y * W + x] = va > 0 ? su / va : -1;
    }
  }
  return ven;
}

const kanaly = [0, 1, 2].map((k) => {
  const c = new Float64Array(W * H);
  for (let p = 0; p < W * H; p++) c[p] = data[p * 4 + k];
  return [prumerStrany(c, 0, ZAPLATA), prumerStrany(c, 1, ZAPLATA)];
});

/* --- složení a přebarvení --- */
const ven = Buffer.alloc(W * H * 4);
for (let p = 0; p < W * H; p++) {
  let r, g, bb;
  if (maska[p]) {
    const s = strana[p];
    r = kanaly[0][s][p]; g = kanaly[1][s][p]; bb = kanaly[2][s][p];
    /* Kdyby na dané straně v okolí nebyl žádný papír, vezme se druhá. */
    if (r < 0) { r = kanaly[0][1 - s][p]; g = kanaly[1][1 - s][p]; bb = kanaly[2][1 - s][p]; }
  } else {
    r = data[p * 4]; g = data[p * 4 + 1]; bb = data[p * 4 + 2];
  }
  const [, , l] = naHsl(Math.max(0, r), Math.max(0, g), Math.max(0, bb));
  const [nr, ng, nb] = naRgb(ODSTIN, SYTOST, l);
  ven[p * 4] = nr; ven[p * 4 + 1] = ng; ven[p * 4 + 2] = nb; ven[p * 4 + 3] = 255;
}

const vysledek = await sharp(ven, { raw: { width: W, height: H, channels: 4 } })
  .webp({ quality: 92 })
  .toFile(CIL);

console.log(`${CIL}  ${W}x${H}, ${(vysledek.size / 1024).toFixed(0)} kB`);
console.log(`  smazáno ${pocetInkoustu} px potisku (${(pocetInkoustu / (W * H) * 100).toFixed(1)} % desky)`);
console.log(`  poměr výška/šířka = ${(H / W * 100).toFixed(1)} %`);
