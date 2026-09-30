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
 * plná linka, co bílé, je papír. Barva se pak nastaví natvrdo na hnědou —
 * přebarvovat odstín nemá u černé co dělat, černá žádný odstín nemá.
 *
 * Ořez na kresbu je nutný: každý sken má kolem sebe jinak velký bílý okraj
 * a v řadě ikonek by se pak jedna zdála menší než druhá.
 *
 * Kromě samostatných kreseb umí skript vyříznout ikonku z většího archu —
 * viz VYREZY níž. Oblast se zadává hrubě, přesný ořez si skript dotáhne sám
 * podle inkoustu; musí ale sedět tak, aby do ní nezasahovala sousední ikona.
 *
 * Každá předloha má jinak silný tah: výřez z archu je široký kolem dvou set
 * pixelů, samostatná kresba skoro tisíc, a po zmenšení na společnou šířku
 * z toho vyjde jednou tlustá a jednou vlásková linka. Skript proto tah
 * dorovnává — `ztenceni` je změna v pixelech VÝSTUPU na každé straně tahu,
 * kladná ubírá, záporná přidává.
 *
 * Aby to šlo dávkovat po zlomku pixelu, klíčuje se na několikanásobku
 * výstupní šířky a teprve hotová silueta se zmenší. Prahem se to dělat nedá:
 * ten by z lehkých tahů ukousl víc než z tmavých a kresba by se rozpadla. */

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
    oblast: { left: 440, top: 168, width: 180, height: 140 } },
  { zdroj: "prstynky a disko.jpg", klic: "party",
    oblast: { left: 615, top: 764, width: 127, height: 144 } },
  { zdroj: "prstynky a disko.jpg", klic: "tanec",
    oblast: { left: 850, top: 40, width: 200, height: 158 } },
];

/* Výchozí hodnoty pro výřezy z archů: textura papíru potřebuje vyšší práh
 * a tah se musí ztenčit, ať sedí k samostatným kresbám. */
const ARCH_PAPIR = 40;
const ARCH_ZTENCENI = 0.4;

/* Samostatné kresby se naopak zmenšují tolik, že jim tah zeslábne — tady se
 * o kus přidá. Klíč je název souboru bez pořadí. */
const ZTENCENI_KRESEB = { snidane: -0.4 };

/* Na kolikanásobku výstupní šířky se pracuje. Určuje, po jak jemných krocích
 * se dá tah měnit: čtyřnásobek znamená čtvrtiny pixelu výstupu. */
const ZVETSENI = 4;

/* Barva linek. Stejný tón jako písmo v sekci programu — ikonky a text mají
 * působit jako jedna kresba. */
const BARVA = [0x6b, 0x53, 0x40];

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

/** Načte kresbu (případně výřez z archu) v pracovním rozlišení. */
async function nacti(soubor, oblast) {
  let obraz = sharp(`${SLOZKA}/${soubor}`);
  if (oblast) obraz = obraz.extract(oblast);
  const { data, info } = await obraz
    .resize({ width: SIRKA * ZVETSENI, kernel: "lanczos3" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
}

/** Opak ztenčení: maximum z okolí tah rozšíří. Krytí jádra tím neutrpí, jen
 *  se přidá na okrajích, takže se dilatovat smí přímo alfa. */
function ztloustit(alfa, W, H, r) {
  if (r < 1) return alfa;
  const max1D = (zdroj, cil, delka, pocet, krok) => {
    for (let i = 0; i < pocet; i++) {
      for (let j = 0; j < delka; j++) {
        let m = 0;
        for (let d = -r; d <= r; d++) {
          const k = j + d;
          if (k >= 0 && k < delka) m = Math.max(m, zdroj[i * krok.i + k * krok.j]);
        }
        cil[i * krok.i + j * krok.j] = m;
      }
    }
  };
  const mez = new Float32Array(W * H);
  max1D(alfa, mez, W, H, { i: W, j: 1 });
  const ven = new Float32Array(W * H);
  max1D(mez, ven, H, W, { i: 1, j: W });
  return ven;
}

/** Z dat RGBA udělá barevnou siluetu oříznutou na inkoust. */
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

  const r = Math.round(Math.abs(ztenceni) * ZVETSENI);
  const zeslabena = ztenceni >= 0
    ? ztencit(alfa, W, H, r)
    : ztloustit(alfa, W, H, r);
  const sirka = maxX - minX + 1, vyska = maxY - minY + 1;
  const ven = Buffer.alloc(sirka * vyska * 4);
  for (let y = 0; y < vyska; y++) {
    for (let x = 0; x < sirka; x++) {
      const q = (y * sirka + x) * 4;
      ven[q] = BARVA[0]; ven[q + 1] = BARVA[1]; ven[q + 2] = BARVA[2];
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
for (const v of VYREZY) {
  const { data, W, H } = await nacti(v.zdroj, v.oblast);
  const r = await ikonka(data, W, H, v.klic, v.papir ?? ARCH_PAPIR, v.ztenceni ?? ARCH_ZTENCENI);
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
  const { data, W, H } = await nacti(soubor);
  const r = await ikonka(data, W, H, klic, PAPIR, ZTENCENI_KRESEB[klic] ?? 0);
  if (!r) { console.log(`${soubor}: nenašel jsem žádnou kresbu, přeskakuji`); continue; }
  console.log(`${poradi}. ${klic}  inkoust ${r.sirka}x${r.vyska} → ${r.vysledek.width}x${r.vysledek.height}, ${(r.vysledek.size / 1024).toFixed(0)} kB`);
}
