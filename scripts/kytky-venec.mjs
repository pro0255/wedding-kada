/* Věnec kolem scény příběhu.
 *
 *   node scripts/kytky-venec.mjs
 *
 * Předlohy jsou v public/kytky u obalky. Věnec je hotová sestava květin na
 * bílém papíře — přesně tak, jak má na stránce vypadat. Skládat ho na webu
 * z jednotlivých květin znamenalo hádat polohy podle obrázku; takhle je sestava
 * daná a web ji jen položí na místo.
 *
 * Ukládá se nadvakrát, do dvou obrázků STEJNÝCH rozměrů. Spodní je celý věnec;
 * z vrchního jsou vidět jen květy, které mají na stránce ležet přes fotky
 * a obálku. Dvě vrstvy musí být proto, že vrstva zakládá vlastní kontext
 * vrstvení a z-index uvnitř jednoho obrázku by se k obálce nedostal.
 *
 * Vrchní vrstva se nevyřezává z věnce — skládá se ze samostatných výstřižků
 * (NAVRCH), které jsou ve složce vedle něj. Vyřezávat nešlo: květy se ve věnci
 * dotýkají sousedních karafiátů, takže každý řez buď ukousl okvětní lístek,
 * nebo z karafiátu vzal cíp, a jedno i druhé nad fotkou viselo s ostrou hranou.
 *
 * Kam výstřižek patří, říká MISTA — obdélník v dílech věnce, odměřený z jeho
 * předlohy. Hledat polohu automaticky podle barevné shody se neosvědčilo: věnec
 * je samý bílý květ, takže nejmenší průměrná odchylka vycházela na poloviční
 * měřítko někde uprostřed, kde se výstřižek schoval mezi okvětní lístky.
 *
 * Bílé pozadí se odmaskuje záplavou od okrajů, ne prahem jasu. Práh by nestačil:
 * bílé květy mají uvnitř skoro stejný jas jako papír, takže by z nich zůstaly
 * poloprůhledné duchy a fotka by jimi prosvítala. Záplava naopak ubere jen to
 * bílé, co souvisle navazuje na okraj. Papír uzavřený mezi stonky se k okraji
 * nedostane, a ten dobere práh na čistou bílou — okvětní lístky mají i na světle
 * stíny, kdežto vyexportovaný podklad je přesně bílý. */

import sharp from "sharp";

const SLOZKA = "public/kytky u obalky";
const VENEC = `${SLOZKA}/kytky ram gerbera.png`;
/* Výstřižky, které leží přes fotky a obálku. Každý soubor nese víc květů
 * pohromadě, ale ve věnci jsou rozházené jinak, než jak stojí v něm — proto se
 * rozřeže na jednotlivé květy a každý se posadí zvlášť.
 *
 * `kvety` jsou seřazené shora dolů, jak je skript v souboru najde, a u každého
 * stojí jeho místo ve věnci: levý horní roh a šířka v dílech šířky věnce. Výška
 * se dopočítá z poměru stran, aby se květ nedeformoval. */
const NAVRCH = [
  {
    soubor: `${SLOZKA}/01_kvetiny_bile.png`,
    kvety: [
      { x: 0.250, y: 0.740, sirka: 0.145 }, // plný bílý květ, dole vlevo
      { x: 0.122, y: 0.545, sirka: 0.148 }, // bílá sasanka nad ním
      { x: 0.152, y: 0.282, sirka: 0.162 }, // žlutý ibišek nahoře
    ],
  },
  {
    soubor: `${SLOZKA}/08_krasenka.png`,
    /* Krásenky do sebe zasahují skoro půlkou květu, takže odleptat je od sebe
       nejde — rozpadly by se dřív, než se oddělí. Dělí se proto podle svých
       žlutozelených středů: ty jsou tři, jasně od sebe a v okvětních lístcích
       se taková barva nikde jinde nevyskytuje. */
    stredy: (r, g, b) => g > 110 && g - b > 45 && r > 90 && b < 140,
    kvety: [
      { x: 0.845, y: 0.535, sirka: 0.112 }, // vpravo nahoře
      { x: 0.772, y: 0.700, sirka: 0.124 }, // prostřední
      { x: 0.662, y: 0.706, sirka: 0.120 }, // nejlevější
    ],
  },
];
const CIL = "public/kytky";

/* Nad tímhle jasem je papír, pokud na papír u okraje souvisle navazuje. */
const PAPIR = 243;
/* A tenhle jas je papír vždycky, i uzavřený mezi stonky. */
const CISTA_BILA = 252;

/* Načte obrázek, odmaskuje papír a vrátí data i meze obsahu. */
async function nacti(cesta) {
  const { data, info } = await sharp(cesta).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  const jas = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    jas[p] = (data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2]) / 3;
  }

  /* Výstřižky mají pozadí průhledné, věnec bílé. Obojí se tu srovná na jedno:
     co je průhledné nebo bílé, je prázdno. */
  const pozadi = new Uint8Array(W * H);
  const fronta = [];
  const pridej = (p) => {
    if (p >= 0 && p < W * H && !pozadi[p] && (data[p * 4 + 3] < 24 || jas[p] >= PAPIR)) {
      pozadi[p] = 1;
      fronta.push(p);
    }
  };
  for (let x = 0; x < W; x++) { pridej(x); pridej((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { pridej(y * W); pridej(y * W + W - 1); }
  while (fronta.length) {
    const q = fronta.pop();
    const qx = q % W, qy = (q / W) | 0;
    if (qx > 0) pridej(q - 1);
    if (qx < W - 1) pridej(q + 1);
    if (qy > 0) pridej(q - W);
    if (qy < H - 1) pridej(q + W);
  }
  for (let p = 0; p < W * H; p++) if (data[p * 4 + 3] < 24 || jas[p] >= CISTA_BILA) pozadi[p] = 1;

  /* Hrana se změkčí průměrem z okolí — ostrý přechod vypadá vystřižený nůžkami. */
  const alfa = new Float32Array(W * H);
  let minX = W, maxX = 0, minY = H, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let soucet = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= W) continue;
          soucet += pozadi[yy * W + xx] ? 0 : 1;
          n++;
        }
      }
      const a = soucet / n;
      alfa[y * W + x] = a;
      if (a > 0.5) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) throw new Error(`v předloze ${cesta} jsem nenašel žádné květiny`);
  return { data, alfa, W, H, minX, minY, sirka: maxX - minX + 1, vyska: maxY - minY + 1 };
}

/* Ořízne na obsah a převede na RGBA o zadané šířce. */
async function orez(o, sirkaVen) {
  const ven = Buffer.alloc(o.sirka * o.vyska * 4);
  for (let y = 0; y < o.vyska; y++) {
    for (let x = 0; x < o.sirka; x++) {
      const p = (y + o.minY) * o.W + (x + o.minX), q = (y * o.sirka + x) * 4;
      ven[q] = o.data[p * 4]; ven[q + 1] = o.data[p * 4 + 1]; ven[q + 2] = o.data[p * 4 + 2];
      ven[q + 3] = Math.round(255 * o.alfa[p]);
    }
  }
  const sirka = sirkaVen ?? o.sirka;
  const vyska = Math.max(1, Math.round((o.vyska / o.sirka) * sirka));
  const data = await sharp(ven, { raw: { width: o.sirka, height: o.vyska, channels: 4 } })
    .resize(sirka, vyska, { fit: "fill" })
    .raw()
    .toBuffer();
  return { data, W: sirka, H: vyska };
}

const venec = await nacti(VENEC);
const { sirka, vyska } = venec;
console.log(`věnec ${sirka}x${vyska}`);

const venecPlny = await orez(venec);

/* Rozdělí výstřižek na jednotlivé květy a vrátí je seřazené shora dolů.
   Souvislé ostrovy nestačí — okvětní lístky se dotýkají, takže celý soubor
   bývá jeden kus. Maska se proto nejdřív odleptává, dokud se nerozpadne na
   tolik jader, kolik se čeká, a pak se jádra zase současně rozlévají zpátky do
   původního tvaru. Který pixel připadne kterému květu, tím rozhodne vzdálenost,
   ne pořadí — a hranice vede tudy, kudy se květy dotýkají. */
function rozdel(o, pocet, stredy) {
  const { W, H, alfa } = o;
  const je = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) je[p] = alfa[p] > 0.5 ? 1 : 0;

  const ostrovy = (maska) => {
    const cislo = new Int32Array(W * H);
    const nalezene = [];
    for (let start = 0; start < W * H; start++) {
      if (cislo[start] || !maska[start]) continue;
      const id = nalezene.length + 1;
      const zasobnik = [start];
      cislo[start] = id;
      let velikost = 0;
      while (zasobnik.length) {
        const q = zasobnik.pop();
        velikost++;
        const qx = q % W, qy = (q / W) | 0;
        const sousedi = [
          qx > 0 ? q - 1 : -1, qx < W - 1 ? q + 1 : -1,
          qy > 0 ? q - W : -1, qy < H - 1 ? q + W : -1,
        ];
        for (const n of sousedi) {
          if (n < 0 || cislo[n] || !maska[n]) continue;
          cislo[n] = id;
          zasobnik.push(n);
        }
      }
      nalezene.push({ id, velikost });
    }
    return { cislo, nalezene };
  };

  const drobek = (W * H) / 1600;

  /* Když má květ poznávací střed, jsou jádra rovnou ta — odleptávání se přeskočí.
     Je to spolehlivější: květy, které se překrývají půlkou, se odleptají dřív,
     než se od sebe oddělí, a rozpadnou se na nesmyslné kusy. */
  if (stredy) {
    const barevne = new Uint8Array(W * H);
    for (let p = 0; p < W * H; p++) {
      if (!je[p]) continue;
      if (stredy(o.data[p * 4], o.data[p * 4 + 1], o.data[p * 4 + 2])) barevne[p] = 1;
    }
    const nalezene = ostrovy(barevne);
    const velke = nalezene.nalezene
      .filter((k) => k.velikost > (W * H) / 20000)
      .sort((a, b) => b.velikost - a.velikost)
      .slice(0, pocet);
    if (velke.length < pocet) {
      throw new Error(`středů květů jsem našel ${velke.length}, čekal jsem ${pocet}`);
    }
    return rozliv(o, je, nalezene.cislo, velke, W, H, alfa);
  }

  /* odleptávání po jednom pixelu, dokud jader nepřibude na potřebný počet */
  let leptana = je;
  let jadra = ostrovy(leptana);
  for (let krok = 0; krok < Math.max(W, H) && jadra.nalezene.filter((o) => o.velikost > drobek).length < pocet; krok++) {
    const dalsi = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = y * W + x;
        if (!leptana[p]) continue;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) continue;
        if (leptana[p - 1] && leptana[p + 1] && leptana[p - W] && leptana[p + W]) dalsi[p] = 1;
      }
    }
    leptana = dalsi;
    jadra = ostrovy(leptana);
  }
  const velka = jadra.nalezene.filter((o) => o.velikost > drobek).slice(0, pocet);
  if (velka.length < pocet) throw new Error(`v ${o.cesta} jsem nenašel ${pocet} květů`);

  return rozliv(o, je, jadra.cislo, velka, W, H, alfa);
}

/* Současné rozlévání jader zpátky do původního tvaru. Který pixel připadne
   kterému květu, rozhodne vzdálenost od jádra, ne pořadí — hranice tak vede
   tudy, kudy se květy dotýkají. Vrací díly seřazené shora dolů. */
function rozliv(o, je, cislo, jadra, W, H, alfa) {
  const komu = new Int32Array(W * H);
  let fronta = [];
  for (let p = 0; p < W * H; p++) {
    const id = cislo[p];
    if (id && jadra.some((j) => j.id === id)) { komu[p] = id; fronta.push(p); }
  }
  while (fronta.length) {
    const dalsi = [];
    for (const q of fronta) {
      const qx = q % W, qy = (q / W) | 0;
      const sousedi = [
        qx > 0 ? q - 1 : -1, qx < W - 1 ? q + 1 : -1,
        qy > 0 ? q - W : -1, qy < H - 1 ? q + W : -1,
      ];
      for (const n of sousedi) {
        if (n < 0 || komu[n] || !je[n]) continue;
        komu[n] = komu[q];
        dalsi.push(n);
      }
    }
    fronta = dalsi;
  }

  return jadra
    .map(({ id }) => {
      let minX = W, maxX = 0, minY = H, maxY = 0;
      for (let p = 0; p < W * H; p++) {
        if (komu[p] !== id) continue;
        const x = p % W, y = (p / W) | 0;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const data = Buffer.alloc(W * H * 4);
      const alfaKusu = new Float32Array(W * H);
      for (let p = 0; p < W * H; p++) {
        if (komu[p] !== id) continue;
        data[p * 4] = o.data[p * 4]; data[p * 4 + 1] = o.data[p * 4 + 1];
        data[p * 4 + 2] = o.data[p * 4 + 2]; data[p * 4 + 3] = Math.round(255 * alfa[p]);
        alfaKusu[p] = alfa[p];
      }
      return {
        data, alfa: alfaKusu, W, H, minX, minY,
        sirka: maxX - minX + 1, vyska: maxY - minY + 1,
      };
    })
    .sort((a, b) => a.minY - b.minY);
}

const mistaVystrizku = [];
for (const { soubor, kvety, stredy } of NAVRCH) {
  const cely = await nacti(soubor);
  const kusy = rozdel({ ...cely, cesta: soubor }, kvety.length, stredy);
  for (let i = 0; i < kvety.length; i++) {
    const { x, y, sirka: dilSirky } = kvety[i];
    const vlozeny = await orez(kusy[i], Math.round(sirka * dilSirky));
    mistaVystrizku.push({ kus: vlozeny, x: Math.round(sirka * x), y: Math.round(vyska * y) });
    console.log(
      `${soubor.split("/").pop()} #${i + 1}  ${vlozeny.W}x${vlozeny.H} na `
      + `${Math.round(sirka * x)}/${Math.round(vyska * y)}`,
    );
  }
}

/* --- dva obrázky na stejném plátně --- */
async function uloz(jmeno, obsah) {
  const vysledek = await sharp(obsah, { raw: { width: sirka, height: vyska, channels: 4 } })
    .resize({ width: 1400, withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 100 })
    .toFile(`${CIL}/${jmeno}.webp`);
  console.log(`${CIL}/${jmeno}.webp  ${vysledek.width}x${vysledek.height}, ${(vysledek.size / 1024).toFixed(0)} kB`);
}

await uloz("venec-pod", venecPlny.data);

/* Vrchní vrstva: prázdné plátno velikosti věnce a v něm výstřižky na svých
   místech. Skládá se přímo kopírováním pixelů — composite by u raw vstupů
   znamenal každý kus zvlášť zakódovat. */
const navrch = Buffer.alloc(sirka * vyska * 4);
for (const { kus, x: px, y: py } of mistaVystrizku) {
  for (let y = 0; y < kus.H; y++) {
    const cy = y + py;
    if (cy < 0 || cy >= vyska) continue;
    for (let x = 0; x < kus.W; x++) {
      const cx = x + px;
      if (cx < 0 || cx >= sirka) continue;
      const q = (y * kus.W + x) * 4, c = (cy * sirka + cx) * 4;
      if (kus.data[q + 3] <= navrch[c + 3]) continue;
      navrch[c] = kus.data[q]; navrch[c + 1] = kus.data[q + 1];
      navrch[c + 2] = kus.data[q + 2]; navrch[c + 3] = kus.data[q + 3];
    }
  }
}

await uloz("venec-nad", navrch);
console.log(`poměr šířka/výška = ${(sirka / vyska).toFixed(4)}`);
