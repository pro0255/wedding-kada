/* Ikonky k programu dne.
 *
 *   node scripts/program-ikony.mjs
 *
 * Bere všechny kresby z public/program pojmenované „<pořadí>. <název>.jpg“
 * a dělá z nich modré ikonky s průhledným pozadím. Až přibude další kresba,
 * stačí ji do složky hodit a skript pustit znovu — nic se nepřepisuje ručně.
 *
 * Kresby jsou černé linky na bílém papíře, uložené jako JPEG. Průhlednost se
 * proto nebere z alfa kanálu (žádný tam není), ale z tmavosti: co je černé, je
 * plná linka, co bílé, je papír. Barva se pak nastaví natvrdo na modrou —
 * přebarvovat odstín nemá u černé co dělat, černá žádný odstín nemá.
 *
 * Ořez na kresbu je nutný: každý sken má kolem sebe jinak velký bílý okraj
 * a v řadě ikonek by se pak jedna zdála menší než druhá. */

import sharp from "sharp";
import { readdir } from "node:fs/promises";

const SLOZKA = "public/program";

/* Modrá linek. Stejný tón jako písmo v sekci programu — ikonky a text mají
 * působit jako jedna kresba. */
const MODRA = [0x35, 0x60, 0x7f];

/* Šířka výstupu. Ikonky se zobrazují kolem 110 px, tohle je rezerva na
 * displeje s dvojnásobnou hustotou. */
const SIRKA = 320;

/* Prahy tmavosti pro průhlednost. Pod spodním je to papír, nad horním plná
 * linka; mezi tím měkký okraj tahu, který musí zůstat měkký — tvrdý práh
 * z kresby udělá zubatou šablonu. */
const PAPIR = 26;
const LINKA = 110;

const prah = (v, od, do_) => {
  const t = Math.min(1, Math.max(0, (v - od) / (do_ - od)));
  return t * t * (3 - 2 * t);
};

/** „1. snidane.jpg“ → { poradi: 1, klic: "snidane" } */
function rozeber(soubor) {
  const m = soubor.match(/^(\d+)[.\s-]+(.+)\.(jpe?g|png)$/i);
  if (!m) return null;
  const klic = m[2]
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { poradi: Number(m[1]), klic };
}

const soubory = (await readdir(SLOZKA)).filter((f) => rozeber(f));
if (!soubory.length) {
  console.log(`v ${SLOZKA} nejsou žádné kresby ve tvaru „1. nazev.jpg“`);
}

for (const soubor of soubory.sort()) {
  const { poradi, klic } = rozeber(soubor);
  const { data, info } = await sharp(`${SLOZKA}/${soubor}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  const alfa = new Float32Array(W * H);
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let p = 0; p < W * H; p++) {
    /* Tmavost, ne jas: kresba je tmavá na světlém. */
    const jas = (data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2]) / 3;
    const a = prah(255 - jas, PAPIR, LINKA);
    alfa[p] = a;
    if (a > 0.35) {
      const x = p % W, y = (p / W) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) { console.log(`${soubor}: nenašel jsem žádnou kresbu, přeskakuji`); continue; }

  const sirka = maxX - minX + 1, vyska = maxY - minY + 1;
  const ven = Buffer.alloc(sirka * vyska * 4);
  for (let y = 0; y < vyska; y++) {
    for (let x = 0; x < sirka; x++) {
      const q = (y * sirka + x) * 4;
      ven[q] = MODRA[0]; ven[q + 1] = MODRA[1]; ven[q + 2] = MODRA[2];
      ven[q + 3] = Math.round(255 * alfa[(y + minY) * W + (x + minX)]);
    }
  }

  const cil = `${SLOZKA}/${klic}.webp`;
  const vysledek = await sharp(ven, { raw: { width: sirka, height: vyska, channels: 4 } })
    .resize({ width: Math.min(sirka, SIRKA) })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(cil);

  console.log(`${poradi}. ${klic}  ${sirka}x${vyska} → ${vysledek.width}x${vysledek.height}, ${(vysledek.size / 1024).toFixed(0)} kB`);
}
