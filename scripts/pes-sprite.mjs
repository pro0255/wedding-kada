/* Převod obrázku psa na pixel-art sprite pro hry.
   Spouští se ručně:  node scripts/pes-sprite.mjs public/fotky/pes.png [šířka]

   Vypíše hotový blok do konzole, odkud se vloží do app/hry/hry/sprity.ts.
   Zároveň uloží náhled _pes-nahled.png, aby šlo hned vidět, co z toho vyšlo.

   Proč skript: převádět siluetu do mřížky od oka znamená hádat, kde má být
   který pixel. Takhle se prahuje a převzorkovává měřením a výsledek je
   opravdu ten poslaný pes, ne jeho nápodoba. */
import sharp from "sharp";

const [, , ZDROJ = "public/fotky/pes.png", SIRKA_ARG] = process.argv;
const SIRKA = Number(SIRKA_ARG) || 26;
/* Kolik obrazu je ještě „pes". Silueta bývá tmavá na světlém, takže se bere
   práh podle jasu; 50 % je bezpečný střed pro černobílý obrázek. */
const PRAH = 0.5;

const { data, info } = await sharp(ZDROJ).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: W, height: H, channels: C } = info;

/* 1. Silueta: pixel patří psovi, když je dost tmavý a není průhledný. */
const pes = new Uint8Array(W * H);
for (let p = 0; p < W * H; p++) {
  const i = p * C;
  if (data[i + 3] < 128) continue;
  const jas = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255;
  if (jas < PRAH) pes[p] = 1;
}

/* 2. Ořez na psa — okolo bývá prázdno, které by jinak sežralo rozlišení. */
let x1 = W, x2 = -1, y1 = H, y2 = -1;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!pes[y * W + x]) continue;
  if (x < x1) x1 = x; if (x > x2) x2 = x;
  if (y < y1) y1 = y; if (y > y2) y2 = y;
}
if (x2 < 0) { console.error("V obrázku nic tmavého není — zkontroluj PRAH nebo cestu."); process.exit(1); }
const sw = x2 - x1 + 1, sh = y2 - y1 + 1;

/* 3. Výška se dopočítá z poměru stran předlohy, ať se pes nezploští.
      Sprite se pak ve hře kreslí S×S px na znak, takže rozměr v mřížce
      přímo určuje, jak velká bude překážka. */
const VYSKA = Math.max(1, Math.round(SIRKA * sh / sw));

/* 4. Převzorkování: každý znak mřížky je průměr své plošky v předloze.
      Znak je '#', když je pod ním aspoň POKRYTI plochy psa — to drží tenké
      části (ocas, nohy) a nezanáší šum. */
const POKRYTI = 0.42;
const radky = [];
for (let gy = 0; gy < VYSKA; gy++) {
  let r = "";
  for (let gx = 0; gx < SIRKA; gx++) {
    const ax = x1 + Math.floor(gx * sw / SIRKA), bx = x1 + Math.floor((gx + 1) * sw / SIRKA);
    const ay = y1 + Math.floor(gy * sh / VYSKA), by = y1 + Math.floor((gy + 1) * sh / VYSKA);
    let plnych = 0, celkem = 0;
    for (let y = ay; y < Math.max(by, ay + 1); y++) for (let x = ax; x < Math.max(bx, ax + 1); x++) {
      celkem++; if (pes[y * W + x]) plnych++;
    }
    r += plnych / celkem >= POKRYTI ? "#" : ".";
  }
  radky.push(r);
}

/* 5. Náhled, ať je hned vidět, co z toho vyšlo. */
const M = 12;
const buf = Buffer.alloc(SIRKA * M * VYSKA * M * 3, 0xf2);
for (let y = 0; y < VYSKA; y++) for (let x = 0; x < SIRKA; x++) {
  if (radky[y][x] !== "#") continue;
  for (let dy = 0; dy < M; dy++) for (let dx = 0; dx < M; dx++) {
    const o = (((y * M + dy) * SIRKA * M) + (x * M + dx)) * 3;
    buf[o] = 62; buf[o + 1] = 57; buf[o + 2] = 52;
  }
}
await sharp(buf, { raw: { width: SIRKA * M, height: VYSKA * M, channels: 3 } })
  .png().toFile("_pes-nahled.png");

console.log(`předloha ${W}x${H}, pes v ní zabírá ${sw}x${sh} (poměr ${(sw / sh).toFixed(2)})`);
console.log(`sprite ${SIRKA}x${VYSKA} znaků — náhled v _pes-nahled.png\n`);
radky.forEach((r) => console.log(`    "${r}",`));
