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
 * a v řadě ikonek by se pak jedna zdála menší než druhá.
 *
 * Kromě samostatných kreseb umí skript vyříznout ikonku z většího archu —
 * viz VYREZY níž. Oblast se zadává hrubě, přesný ořez si skript dotáhne sám
 * podle inkoustu; musí ale sedět tak, aby do ní nezasahovala sousední ikona.
 *
 * Výřezy z archu mají oproti samostatným kresbám hrubší linku: na archu je
 * ikonka široká kolem sto padesáti pixelů, kdežto samostatná kresba skoro
 * tisíc, takže se zmenšuje na třetinu a tah se jí ztenčí sám. Aby v jedné řadě
 * seděly, umí skript tah ztenčit — `ztenceni` je úbytek v pixelech zdroje na
 * každé straně tahu. Dělá se to erozí na čtyřikrát zvětšené předloze, ne
 * zvýšením prahu: práh by z lehkých tahů ukousl víc než z tmavých a kresba by
 * se rozpadla. */

import sharp from "sharp";
import { readdir } from "node:fs/promises";

const SLOZKA = "public/program";

/* Ikonky vyřezané z většího archu. `oblast` je hrubý obdélník v pixelech
 * zdroje, `papir` zvedá práh průhlednosti u archů s texturou papíru — na
 * hladkém skenu stačí výchozí hodnota, tady by z textury zbyly tečky. */
const VYREZY = [
  { zdroj: "prstynky a disko.jpg", klic: "obrad",
    oblast: { left: 425, top: 312, width: 200, height: 108 } },
  { zdroj: "prstynky a disko.jpg", klic: "obed",
    oblast: { left: 780, top: 330, width: 240, height: 136 } },
  { zdroj: "prstynky a disko.jpg", klic: "dort",
    oblast: { left: 838, top: 610, width: 190, height: 172 } },
  { zdroj: "prstynky a disko.jpg", klic: "odpoledne",
    oblast: { left: 440, top: 168, width: 215, height: 150 } },
  { zdroj: "prstynky a disko.jpg", klic: "party",
    oblast: { left: 628, top: 772, width: 122, height: 146 } },
  /* Tančící pár je na archu sotva devadesát pixelů široký a kreslený lehkou
     rukou — ztenčovat ho nejde, zmizel by. Nižší práh papíru mu naopak pár
     tahů zachrání. */
  { zdroj: "prstynkyy.png", klic: "tanec", papir: 20, ztenceni: 0,
    oblast: { left: 328, top: 706, width: 76, height: 92 } },
];

/* Výchozí hodnoty pro výřezy z archů: textura papíru potřebuje vyšší práh
 * a tah se musí ztenčit, ať sedí k samostatným kresbám. */
const ARCH_PAPIR = 40;
const ARCH_ZTENCENI = 0.5;

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

/** Ztenčení tahu.
 *
 *  Erodovat přímo alfu nejde: minimum z okolí sebere krytí i jádru tahu, a
 *  kresba místo ztenčení vybledne. Erozi proto dostane jen binární tvar tahu,
 *  ten se rozmázne o pixel doměkka a použije jako maska na původní alfu —
 *  jádro si tak nechá plné krytí a ubere se jen z okrajů.
 *
 *  Počítá se po řádcích a pak po sloupcích; okolí tím vyjde čtvercové místo
 *  kruhového, což je u tahů o pár pixelů nerozeznatelné a o řád levnější. */
function ztencit(alfa, W, H, r) {
  if (r < 1) return alfa;

  const tvar = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) tvar[p] = alfa[p] > 0.5 ? 1 : 0;

  const min1D = (zdroj, cil, delka, pocet, krok) => {
    for (let i = 0; i < pocet; i++) {
      for (let j = 0; j < delka; j++) {
        let m = 1;
        for (let d = -r; d <= r; d++) {
          const k = j + d;
          m = Math.min(m, k < 0 || k >= delka ? 0 : zdroj[i * krok.i + k * krok.j]);
        }
        cil[i * krok.i + j * krok.j] = m;
      }
    }
  };
  const mez = new Float32Array(W * H);
  min1D(tvar, mez, W, H, { i: W, j: 1 });
  const erodovany = new Float32Array(W * H);
  min1D(mez, erodovany, H, W, { i: 1, j: W });

  /* Rozmáznutí o pixel: bez něj má maska schodovitý okraj a ztenčený tah
   * vypadá vyřezaný nůžkami. */
  const rozmaz = (zdroj, cil, delka, pocet, krok) => {
    for (let i = 0; i < pocet; i++) {
      for (let j = 0; j < delka; j++) {
        let s = 0, n = 0;
        for (let d = -1; d <= 1; d++) {
          const k = j + d;
          if (k < 0 || k >= delka) continue;
          s += zdroj[i * krok.i + k * krok.j]; n++;
        }
        cil[i * krok.i + j * krok.j] = s / n;
      }
    }
  };
  rozmaz(erodovany, mez, W, H, { i: W, j: 1 });
  rozmaz(mez, erodovany, H, W, { i: 1, j: W });

  const ven = new Float32Array(W * H);
  for (let p = 0; p < W * H; p++) ven[p] = alfa[p] * erodovany[p];
  return ven;
}

/** Z dat RGBA udělá modrou siluetu oříznutou na inkoust. */
async function ikonka(data, W, H, klic, papir, ztenceni = 0) {
  const alfa = new Float32Array(W * H);
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let p = 0; p < W * H; p++) {
    const jas = (data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2]) / 3;
    const a = prah(255 - jas, papir, LINKA);
    alfa[p] = a;
    if (a > 0.35) {
      const x = p % W, y = (p / W) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) return null;

  const zeslabena = ztencit(alfa, W, H, Math.round(ztenceni));
  const sirka = maxX - minX + 1, vyska = maxY - minY + 1;
  const ven = Buffer.alloc(sirka * vyska * 4);
  for (let y = 0; y < vyska; y++) {
    for (let x = 0; x < sirka; x++) {
      const q = (y * sirka + x) * 4;
      ven[q] = MODRA[0]; ven[q + 1] = MODRA[1]; ven[q + 2] = MODRA[2];
      ven[q + 3] = Math.round(255 * zeslabena[(y + minY) * W + (x + minX)]);
    }
  }

  const vysledek = await sharp(ven, { raw: { width: sirka, height: vyska, channels: 4 } })
    .resize({ width: Math.min(sirka, SIRKA) })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(`${SLOZKA}/${klic}.webp`);
  return { sirka, vyska, vysledek };
}

/* --- ikonky vyřezané z archů --- */
/* Čtyřnásobné zvětšení před klíčováním: eroze se tím dá dávkovat po čtvrtině
 * pixelu zdroje a okraje zůstanou měkké. Zmenšení zpátky řeší až výstup. */
const ZVETSENI = 4;
for (const v of VYREZY) {
  const { data, info } = await sharp(`${SLOZKA}/${v.zdroj}`)
    .extract(v.oblast)
    .resize({ width: v.oblast.width * ZVETSENI, kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const r = await ikonka(data, info.width, info.height, v.klic,
    v.papir ?? ARCH_PAPIR, (v.ztenceni ?? ARCH_ZTENCENI) * ZVETSENI);
  if (!r) { console.log(`${v.klic}: v zadané oblasti není žádná kresba`); continue; }
  console.log(`${v.klic} (výřez z ${v.zdroj})  inkoust ${r.sirka}x${r.vyska} → ${r.vysledek.width}x${r.vysledek.height}, ${(r.vysledek.size / 1024).toFixed(0)} kB`);
}

/* --- samostatné kresby --- */
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
