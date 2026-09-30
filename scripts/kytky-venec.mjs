/* Věnec kolem scény příběhu.
 *
 *   node scripts/kytky-venec.mjs
 *
 * Předlohy v public/kytky u obalky jsou hotové sestavy květin na bílém papíře —
 * přesně tak, jak má věnec na stránce vypadat. Skládat ho na webu z jednotlivých
 * květin znamenalo hádat polohy podle obrázku; takhle je sestava daná a web ji
 * jen položí na místo.
 *
 * Věnec se ukládá nadvakrát, do dvou obrázků STEJNÝCH rozměrů. Spodní je CELÝ
 * věnec; z vrchního je vidět jen pár květů — ty, které mají na stránce ležet
 * přes fotky a obálku. Dvě vrstvy musí být proto, že vrstva zakládá vlastní
 * kontext vrstvení a z-index uvnitř jednoho obrázku by se k obálce nedostal.
 *
 * Které květy to jsou, se nehádá: druhá předloha je tentýž věnec BEZ nich, takže
 * maska vrchní vrstvy je prostě rozdíl obou obrázků. Spodní vrstva přitom
 * zůstává celá — díky tomu nemůže maska nechat díru ani hranu a smí mít měkký
 * okraj, protože co je v ní, leží přesně na tomtéž kusu obrazu pod sebou.
 *
 * Bílé pozadí se odmaskuje záplavou od okrajů, ne prahem jasu. Práh by nestačil:
 * bílé květy mají uvnitř skoro stejný jas jako papír, takže by z nich zůstaly
 * poloprůhledné duchy a fotka by jimi prosvítala. Záplava naopak ubere jen to
 * bílé, co souvisle navazuje na okraj. Papír uzavřený mezi stonky se k okraji
 * nedostane, a ten dobere práh na čistou bílou — okvětní lístky mají i na světle
 * stíny, takže se pod něj vejdou, kdežto vyexportovaný podklad je přesně bílý. */

import sharp from "sharp";

const SLOZKA = "public/kytky u obalky";
const PLNY = `${SLOZKA}/kytky ram gerbera.png`;
const BEZ = `${SLOZKA}/kytky ram bez dvou.png`;
const CIL = "public/kytky";

/* Nad tímhle jasem je papír, pokud na papír u okraje souvisle navazuje. */
const PAPIR = 243;
/* A tenhle jas je papír vždycky, i uzavřený mezi stonky. */
const CISTA_BILA = 252;

/* O kolik se maska vrchní vrstvy roztáhne za obrys květu, v dílech šířky. Obě
 * předlohy jsou vyexportované každá zvlášť a nesedí na pixel, takže samotný
 * rozdíl má po obvodu roztřepený lem. */
const ROZSIRENI = 0.012;

/* Načte předlohu a vrátí její alfu (0 papír, 1 květina) i meze obsahu. */
async function nacti(cesta) {
  const { data, info } = await sharp(cesta).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  const jas = new Uint8Array(W * H);
  for (let p = 0; p < W * H; p++) {
    jas[p] = (data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2]) / 3;
  }

  const pozadi = new Uint8Array(W * H);
  const fronta = [];
  const pridej = (p) => {
    if (p >= 0 && p < W * H && !pozadi[p] && jas[p] >= PAPIR) { pozadi[p] = 1; fronta.push(p); }
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
  for (let p = 0; p < W * H; p++) if (jas[p] >= CISTA_BILA) pozadi[p] = 1;

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

const plny = await nacti(PLNY);
const bez = await nacti(BEZ);
const { sirka, vyska } = plny;
console.log(`plný věnec ${plny.sirka}x${plny.vyska}, bez dvou ${bez.sirka}x${bez.vyska}`);

/* --- maska vrchní vrstvy: co je v plném věnci navíc --- */
/* Předlohy jsou vyexportované každá v jiném měřítku, takže se ta druhá čte přes
   přepočet na ořez té první. */
const rozdil = new Float32Array(sirka * vyska);
let kolik = 0;
for (let y = 0; y < vyska; y++) {
  const by = bez.minY + Math.round((y / vyska) * bez.vyska);
  for (let x = 0; x < sirka; x++) {
    const bx = bez.minX + Math.round((x / sirka) * bez.sirka);
    const a = plny.alfa[(y + plny.minY) * plny.W + (x + plny.minX)];
    const b = bx < bez.W && by < bez.H ? bez.alfa[by * bez.W + bx] : 0;
    if (a > 0.5 && b < 0.5) { rozdil[y * sirka + x] = 1; kolik++; }
  }
}
if (!kolik) throw new Error("předlohy se neliší — nemám co dát navrch");

/* Roztažení a změkčení. Počítá se posuvnými součty: projít okolí každého pixelu
   přímo by při téhle velikosti okna trvalo minuty. */
const rozmazej = (zdroj, r) => {
  const mezi = new Float32Array(sirka * vyska);
  const ven = new Float32Array(sirka * vyska);
  for (let y = 0; y < vyska; y++) {
    for (let x = 0; x < sirka; x++) {
      const od = Math.max(0, x - r), do_ = Math.min(sirka - 1, x + r);
      let soucet = 0;
      if (x === 0) {
        for (let i = od; i <= do_; i++) soucet += zdroj[y * sirka + i];
      } else {
        soucet = mezi[y * sirka + x - 1] * (Math.min(sirka - 1, x - 1 + r) - Math.max(0, x - 1 - r) + 1);
        if (x - 1 - r >= 0) soucet -= zdroj[y * sirka + (x - 1 - r)];
        if (x + r < sirka) soucet += zdroj[y * sirka + (x + r)];
      }
      mezi[y * sirka + x] = soucet / (do_ - od + 1);
    }
  }
  for (let x = 0; x < sirka; x++) {
    for (let y = 0; y < vyska; y++) {
      const od = Math.max(0, y - r), do_ = Math.min(vyska - 1, y + r);
      let soucet = 0;
      if (y === 0) {
        for (let i = od; i <= do_; i++) soucet += mezi[i * sirka + x];
      } else {
        soucet = ven[(y - 1) * sirka + x] * (Math.min(vyska - 1, y - 1 + r) - Math.max(0, y - 1 - r) + 1);
        if (y - 1 - r >= 0) soucet -= mezi[(y - 1 - r) * sirka + x];
        if (y + r < vyska) soucet += mezi[(y + r) * sirka + x];
      }
      ven[y * sirka + x] = soucet / (do_ - od + 1);
    }
  }
  return ven;
};

const polomer = Math.max(2, Math.round(sirka * ROZSIRENI));
/* Nejdřív roztáhnout — všechno, kde průměr vyšel nad nulu, je uvnitř. */
const siroka = rozmazej(rozdil, polomer);
for (let i = 0; i < siroka.length; i++) siroka[i] = siroka[i] > 0.02 ? 1 : 0;
/* A pak změkčit okraj. */
const maska = rozmazej(siroka, Math.max(1, Math.round(polomer / 3)));

/* --- dva obrázky na stejném plátně --- */
async function uloz(jmeno, jenNavrch) {
  const ven = Buffer.alloc(sirka * vyska * 4);
  for (let y = 0; y < vyska; y++) {
    for (let x = 0; x < sirka; x++) {
      const p = (y + plny.minY) * plny.W + (x + plny.minX), q = (y * sirka + x) * 4;
      ven[q] = plny.data[p * 4]; ven[q + 1] = plny.data[p * 4 + 1]; ven[q + 2] = plny.data[p * 4 + 2];
      ven[q + 3] = Math.round(255 * plny.alfa[p] * (jenNavrch ? maska[y * sirka + x] : 1));
    }
  }
  const vysledek = await sharp(ven, { raw: { width: sirka, height: vyska, channels: 4 } })
    .resize({ width: 1400, withoutEnlargement: true })
    .webp({ quality: 86, alphaQuality: 100 })
    .toFile(`${CIL}/${jmeno}.webp`);
  console.log(`${CIL}/${jmeno}.webp  ${vysledek.width}x${vysledek.height}, ${(vysledek.size / 1024).toFixed(0)} kB`);
}

await uloz("venec-pod", false);
await uloz("venec-nad", true);
console.log(`ořez ${sirka}x${vyska}, poměr šířka/výška = ${(sirka / vyska).toFixed(4)}`);
