/* Prostřený stůl pod svatební menu.
 *
 *   node scripts/menu-stul.mjs
 *
 * Předloha (public/menu/menu se stolem.png) je celá deska: vlnkový rámeček s mašlí
 * nahoře a kresba prostřeného stolu dole. Rámeček na webu už máme vlastní,
 * takže se odsud bere jen ten stůl.
 *
 * Pozadí není průhledné, ale jednolitá šedá — odmaskuje se podle vzdálenosti
 * od ní. Kresba je tmavě červená na krémové výplni, obojí je od šedé daleko,
 * takže maska vyjde čistě.
 *
 * Stůl se z desky vybírá záplavou z bodu uvnitř ubrusu. Samotná záplava ale
 * nestačí: spodní linka rámečku se stolu dotýká, takže by po ní utekla do
 * celého rámu. Nejdřív se proto ořízne pruh kolem stolu — jeho šířka se změří
 * na řádcích pod linkou, kde je v obraze jenom stůl — a linka se tím přetne.
 *
 * Přebarvení jde přes HSL: odstín se nastaví natvrdo na modrý, sytost se
 * zastropuje a světlost se zvedne — tmavě červené linky se tím dostanou na
 * baby blue rámečku, zatímco krémová výplň zůstane skoro bílá. Kdyby se místo
 * toho jen otočil odstín, vyšla by z linek tmavá námořnická modř. */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const ZDROJ = "public/menu/menu se stolem.png";
const CIL = "public/menu";

/* Odstín a strop sytosti baby blue rámečku (#a9c4dd). */
const ODSTIN = 207;
const STROP_SYTOSTI = 0.45;
/* Světlost: linka z 0,33 vyjede na 0,75, krémová z 0,98 zůstane na 0,97. */
const SVETLOST = (l) => l * 0.35 + 0.63;

/* Bod uvnitř ubrusu — odtud se stůl zaplavuje. */
const SEMENO = { x: 576, y: 1800 };
/* Řádky, na kterých je v obraze jenom stůl (pod linkou rámečku). Z nich se
 * měří, jak je stůl široký. */
const CISTE_RADKY = { od: 1700, do: 2040 };
/* Řádek těsně pod linkou rámečku. Nad ním už stůl nikde není širší, takže se
 * podle něj dá useknout to, co z linky trčí po stranách. */
const RADEK_POD_LINKOU = 1660;

const prah = (v, od, do_) => {
  const t = Math.min(1, Math.max(0, (v - od) / (do_ - od)));
  return t * t * (3 - 2 * t);
};

function naHsl(r, g, b) {
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
}

function naRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const kanal = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [kanal(h + 1 / 3), kanal(h), kanal(h - 1 / 3)].map((v) => Math.round(v * 255));
}

const { data, info } = await sharp(ZDROJ).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;

/* --- maska: pryč s šedým pozadím --- */
const [pr, pg, pb] = [data[0], data[1], data[2]];
const alfa = new Float32Array(W * H);
for (let p = 0; p < W * H; p++) {
  const d = Math.hypot(data[p * 4] - pr, data[p * 4 + 1] - pg, data[p * 4 + 2] - pb);
  alfa[p] = prah(d, 12, 40);
}

/* --- pruh kolem stolu: přetne linku rámečku ---
 * Šířka se měří na řádcích pod linkou, kde v obraze žádný rám není. Svisle
 * se začíná kousek nad nejvyšší svíčkou — výš už je jenom rám. */
let tblMin = W, tblMax = 0, tblTop = H;
for (let y = CISTE_RADKY.od; y <= Math.min(CISTE_RADKY.do, H - 1); y++) {
  for (let x = 0; x < W; x++) {
    if (alfa[y * W + x] <= 0.5) continue;
    if (x < tblMin) tblMin = x;
    if (x > tblMax) tblMax = x;
  }
}
for (let y = 1000; y < H; y++) {
  let je = false;
  for (let x = tblMin; x <= tblMax; x++) if (alfa[y * W + x] > 0.5) { je = true; break; }
  if (je) { tblTop = y; break; }
}

const OKRAJ = 4;
const pruh = {
  x1: Math.max(0, tblMin - OKRAJ),
  x2: Math.min(W - 1, tblMax + OKRAJ),
  y1: Math.max(0, tblTop - OKRAJ),
};
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (x < pruh.x1 || x > pruh.x2 || y < pruh.y1) alfa[y * W + x] = 0;
  }
}

/* Uvnitř pruhu zůstávají po lince ještě dva kousky po stranách — tam, kde se
 * vynořuje mezi stolem a okrajem pruhu.
 *
 * Poznají se podle tvaru: linka je ležatý tah, vysoký sotva dvacet pixelů,
 * kdežto všechno, co u kraje patří ke stolu, jsou svisle dlouhé věci —
 * svíčky, nohy a příčle židlí. Maže se proto podle délky svislého souvislého
 * úseku, a jen u okrajů pruhu, aby to nesáhlo na talíře a příbory uprostřed. */
const OKOLI_KRAJE = 150;
const NEJKRATSI_SVISLE = 30;
const svisle = new Int32Array(W * H);
for (let x = 0; x < W; x++) {
  let y = 0;
  while (y < H) {
    if (alfa[y * W + x] <= 0.5) { y++; continue; }
    let k = y;
    while (k < H && alfa[k * W + x] > 0.5) k++;
    for (let i = y; i < k; i++) svisle[i * W + x] = k - y;
    y = k;
  }
}
let smazano = 0;
for (let y = 0; y < H; y++) {
  for (let x = pruh.x1; x <= pruh.x2; x++) {
    const uKraje = x - pruh.x1 < OKOLI_KRAJE || pruh.x2 - x < OKOLI_KRAJE;
    if (!uKraje) continue;
    const p = y * W + x;
    if (alfa[p] > 0.5 && svisle[p] < NEJKRATSI_SVISLE) { alfa[p] = 0; smazano++; }
  }
}
console.log("pruh se stolem: x " + pruh.x1 + ".." + pruh.x2 + ", od y " + pruh.y1
  + "; smazáno " + smazano + " px ležaté linky u krajů");

/* --- záplava od semene: co je stůl --- */
/* Zásobník, ne rekurze — deska má přes dva miliony pixelů a zásobník volání
 * by přetekl. */
const stul = new Uint8Array(W * H);
const zasobnik = [SEMENO.y * W + SEMENO.x];
if (alfa[zasobnik[0]] <= 0.5) throw new Error("semeno leží mimo kresbu — zkontroluj SEMENO");
stul[zasobnik[0]] = 1;
while (zasobnik.length) {
  const p = zasobnik.pop();
  const x = p % W, y = (p / W) | 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const np = ny * W + nx;
    if (stul[np] || alfa[np] <= 0.5) continue;
    stul[np] = 1;
    zasobnik.push(np);
  }
}

/* --- výřez a přebarvení --- */
let minX = W, maxX = 0, minY = H, maxY = 0;
for (let p = 0; p < W * H; p++) {
  if (!stul[p]) continue;
  const x = p % W, y = (p / W) | 0;
  if (x < minX) minX = x;
  if (x > maxX) maxX = x;
  if (y < minY) minY = y;
  if (y > maxY) maxY = y;
}

const sirka = maxX - minX + 1, vyska = maxY - minY + 1;
const ven = Buffer.alloc(sirka * vyska * 4);
for (let y = 0; y < vyska; y++) {
  for (let x = 0; x < sirka; x++) {
    const p = (y + minY) * W + (x + minX);
    const q = (y * sirka + x) * 4;
    if (!stul[p]) continue;
    const [h, s, l] = naHsl(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]);
    const [r, g, b] = naRgb(ODSTIN, Math.min(s, STROP_SYTOSTI), SVETLOST(l));
    ven[q] = r; ven[q + 1] = g; ven[q + 2] = b;
    ven[q + 3] = Math.round(255 * alfa[p]);
  }
}

await mkdir(CIL, { recursive: true });
const vysledek = await sharp(ven, { raw: { width: sirka, height: vyska, channels: 4 } })
  .resize({ width: Math.min(sirka, 900) })
  .webp({ quality: 92, alphaQuality: 100 })
  .toFile(`${CIL}/stul.webp`);

console.log(`${CIL}/stul.webp  výřez ${minX},${minY} ${sirka}x${vyska} → ${vysledek.width}x${vysledek.height}, ${(vysledek.size / 1024).toFixed(0)} kB`);
console.log(`  poměr výška/šířka = ${(vyska / sirka * 100).toFixed(1)} %`);
