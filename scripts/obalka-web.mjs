/* Obálka s příběhem: z fotek v public/fotky udělá vrstvy pro web.
 *
 *   node scripts/obalka-web.mjs
 *
 * Zdrojem jsou dvě fotky, zavřená a otevřená obálka. Ani jedna nemá průhledné
 * pozadí — zavřená leží na krémovém podkladu, otevřená má do JPEGu zapečenou
 * šachovnici, kterou exportér kreslí místo průhlednosti. Obojí se tu odmaskuje.
 *
 * Z otevřené obálky se navíc dělají DVĚ vrstvy, aby mohl papír s textem
 * vyjíždět zevnitř:
 *
 *   zadek  — obálka i s vyklopenou chlopní; bílá kartička, která na fotce leží
 *            uvnitř, se přebarví na vnitřek obálky, takže zůstane prázdná
 *   predek — jen přední kapsa (spodní trojúhelník), která se v CSS položí
 *            přes papír
 *
 * Papír pak v CSS leží mezi nimi. Kdyby se použila jedna vrstva, papír by buď
 * překryl celou obálku, nebo zmizel za ní — mezi ně by se nevešel.
 *
 * Hranice kapsy se neodhaduje, měří se: pro každý sloupec se najde spodní okraj
 * bílé kartičky a tím se vede maska. Rovná čára by u zaobleného dna neseděla.
 *
 * Výstupem je WebP s alfou — fotky jsou hladké přechody, na které je PNG
 * zbytečně velké (rozdíl je řádový). */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const ZAVRENA = "public/fotky/obalka zavřená.jpg";
const OTEVRENA = "public/fotky/obalka otevřená.jpg";
const CIL = "public/obalka";

/* Obě vrstvy otevřené obálky musí sedět pixel na pixel, proto se ořezávají
 * na stejný obdélník. Šířka výstupu je společná i pro zavřenou obálku, aby
 * se při prolnutí nezměnila velikost. */
const SIRKA = 1040;

/** Plynulý přechod 0→1 mezi dvěma prahy — tvrdá hranice dělá zubaté okraje. */
const prah = (v, od, do_) => {
  const t = Math.min(1, Math.max(0, (v - od) / (do_ - od)));
  return t * t * (3 - 2 * t);
};

/** Načte obrázek jako syrové RGBA. */
async function syrove(soubor) {
  const { data, info } = await sharp(soubor)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

/* ---------- zavřená obálka ---------- */
/* Pozadí je jednolitá krémová. Klíčuje se na vzdálenost od ní: obálka je
 * modrošedá, takže je od podkladu daleko a maska vyjde čistá. */
{
  const { data, w, h } = await syrove(ZAVRENA);
  const [pr, pg, pb] = [data[0], data[1], data[2]];
  let minX = w, maxX = 0, minY = h, maxY = 0;

  for (let p = 0; p < w * h; p++) {
    const d = Math.hypot(data[p * 4] - pr, data[p * 4 + 1] - pg, data[p * 4 + 2] - pb);
    const a = prah(d, 14, 34);
    data[p * 4 + 3] = Math.round(255 * a);
    if (a > 0.5) {
      const x = p % w, y = (p / w) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  await mkdir(CIL, { recursive: true });
  const sirkaOrez = maxX - minX + 1;
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: minX, top: minY, width: sirkaOrez, height: maxY - minY + 1 })
    .resize({ width: SIRKA })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(`${CIL}/zavrena.webp`);

  console.log(`zavrena.webp  ořez ${minX},${minY} ${sirkaOrez}x${maxY - minY + 1}`);
  console.log(`  poměr výška/šířka = ${((maxY - minY + 1) / sirkaOrez * 100).toFixed(1)} %`);
}

/* ---------- otevřená obálka ---------- */
{
  const { data, w, h } = await syrove(OTEVRENA);
  const jas = (p) => (data[p * 4] + data[p * 4 + 1] + data[p * 4 + 2]) / 3;
  const bily = (p) => {
    const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
    return r > 212 && g > 212 && b > 212 && Math.max(r, g, b) - Math.min(r, g, b) < 16;
  };

  /* Šachovnice pozadí je tmavá (odstíny kolem 30–62), obálka i kartička
   * světlé. Práh na jasu je tu spolehlivější než vzdálenost od barvy —
   * šachovnice má dva odstíny, ne jeden. */
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let p = 0; p < w * h; p++) {
    const a = prah(jas(p), 72, 112);
    data[p * 4 + 3] = Math.round(255 * a);
    if (a > 0.5) {
      const x = p % w, y = (p / w) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const orez = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  console.log(`otevřená  ořez ${minX},${minY} ${orez.width}x${orez.height}`);

  /* Spodní okraj kartičky po sloupcích = horní hrana přední kapsy.
   *
   * Nestačí vzít nejnižší bílý pixel ve sloupci: obálka má na hranách ostré
   * odlesky, které projdou testem na bílou, a kartička by pak sahala až ke
   * kraji. Bere se proto nejdelší souvislý bílý úsek ve sloupci a jen když je
   * dost dlouhý na to, aby to kartička opravdu byla. */
  const NEJKRATSI_USEK = 60;
  const dno = new Int32Array(w).fill(-1);
  const kartickaY = { min: h, max: 0 };
  for (let x = 0; x < w; x++) {
    let zacatek = -1, nejZac = -1, nejDelka = 0;
    for (let y = 0; y <= h; y++) {
      const je = y < h && bily(y * w + x);
      if (je && zacatek < 0) zacatek = y;
      if (!je && zacatek >= 0) {
        if (y - zacatek > nejDelka) { nejDelka = y - zacatek; nejZac = zacatek; }
        zacatek = -1;
      }
    }
    if (nejDelka < NEJKRATSI_USEK) continue;
    dno[x] = nejZac + nejDelka - 1;
    if (nejZac < kartickaY.min) kartickaY.min = nejZac;
    if (dno[x] > kartickaY.max) kartickaY.max = dno[x];
  }
  /* Medián přes okolní sloupce — jeden sloupec, kde se bílá spojila s odleskem,
   * by jinak z masky vystřelil jednopixelový trn. */
  const surove = Int32Array.from(dno);
  for (let x = 0; x < w; x++) {
    if (surove[x] < 0) continue;
    const okoli = [];
    for (let d = -4; d <= 4; d++) {
      const v = surove[x + d];
      if (v !== undefined && v >= 0) okoli.push(v);
    }
    okoli.sort((a, b) => a - b);
    dno[x] = okoli[okoli.length >> 1];
  }

  const sloupceSKartickou = [...dno.keys()].filter((x) => dno[x] >= 0);
  const kartickaX = { min: sloupceSKartickou[0], max: sloupceSKartickou.at(-1) };

  /* Mimo kartičku se hrana kapsy dopočítá ze sklonu u jejího kraje — kapsa
   * pokračuje stejným směrem až k okraji obálky. */
  const sklon = (a, b) => (dno[b] - dno[a]) / (b - a);
  const sklonL = sklon(kartickaX.min + 5, kartickaX.min + 65);
  const sklonP = sklon(kartickaX.max - 65, kartickaX.max - 5);
  const hranaKapsy = (x) => {
    if (dno[x] >= 0) return dno[x];
    return x < kartickaX.min
      ? dno[kartickaX.min + 5] + sklonL * (x - (kartickaX.min + 5))
      : dno[kartickaX.max - 5] + sklonP * (x - (kartickaX.max - 5));
  };

  console.log(`  kartička x ${kartickaX.min}–${kartickaX.max}, y ${kartickaY.min}–${kartickaY.max}`);
  console.log(`  ústa kapsy (nejnižší bod) y = ${Math.max(...sloupceSKartickou.map((x) => dno[x]))}`);

  /* --- zadek: kartička pryč, místo ní vnitřek obálky --- */
  const zadek = Buffer.from(data);
  for (let y = kartickaY.min; y <= kartickaY.max; y++) {
    /* Vnitřek se zeshora dolů mírně stmívá — plochá výplň vypadá jako díra. */
    const t = (y - kartickaY.min) / (kartickaY.max - kartickaY.min);
    const barva = [188 - 34 * t, 204 - 32 * t, 216 - 30 * t];
    for (let x = kartickaX.min; x <= kartickaX.max; x++) {
      const p = y * w + x;
      if (!bily(p)) continue;
      zadek[p * 4] = barva[0];
      zadek[p * 4 + 1] = barva[1];
      zadek[p * 4 + 2] = barva[2];
    }
  }
  await sharp(zadek, { raw: { width: w, height: h, channels: 4 } })
    .extract(orez)
    .resize({ width: SIRKA })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(`${CIL}/otevrena-zadek.webp`);

  /* --- předek: jen přední kapsa --- */
  /* Maska sahá o kus výš než naměřená hrana: papír pak pod kapsu zaleze
   * a mezi nimi nezůstane světlá spára. */
  const PRESAH = 6;
  const predek = Buffer.from(data);
  for (let x = 0; x < w; x++) {
    const hrana = hranaKapsy(x) - PRESAH;
    for (let y = 0; y < h; y++) {
      if (y >= hrana) continue;
      predek[(y * w + x) * 4 + 3] = 0;
    }
  }
  await sharp(predek, { raw: { width: w, height: h, channels: 4 } })
    .extract(orez)
    .resize({ width: SIRKA })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(`${CIL}/otevrena-predek.webp`);

  const pomer = orez.height / orez.width;
  console.log(`otevrena-zadek.webp + otevrena-predek.webp  ${SIRKA}x${Math.round(SIRKA * pomer)}`);
  console.log(`  poměr výška/šířka = ${(pomer * 100).toFixed(1)} %`);
  const usta = Math.max(...sloupceSKartickou.map((x) => dno[x]));
  console.log(`  ústa od horní hrany výřezu = ${((usta - orez.top) / orez.width * 100).toFixed(1)} % šířky`);
}

/* ---------- pečeť ---------- */
/* Vosková pečeť je fotka na bílém — klíčuje se stejně jako zavřená obálka, jen
 * se hlídá i sytost: pečeť je zlatá, takže světlé, ale nevýrazné pixely jsou
 * pozadí, a světlé barevné jsou odlesk na vosku, který musí zůstat.
 *
 * Ořez je na nejmenší obdélník kolem pečeti. Bez něj by kolem ní zůstal bílý
 * rám a v CSS by se musel dopočítávat — takhle se dá obrázek posadit rovnou. */
{
  const ZDROJ = "public/obalka/vosk na obalku.jpg";
  const { data, w, h } = await syrove(ZDROJ);
  let minX = w, maxX = 0, minY = h, maxY = 0;

  for (let p = 0; p < w * h; p++) {
    const r = data[p * 4], g = data[p * 4 + 1], b = data[p * 4 + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    /* Vzdálenost od bílé i sytost — čím dál od bílé nebo čím barevnější,
     * tím neprůhlednější. Bere se to větší z obou, ať projde jak tmavý
     * obrys, tak bledý zlatý odlesk. */
    const odBile = Math.hypot(255 - r, 255 - g, 255 - b);
    const a = Math.max(prah(odBile, 18, 42), prah(max - min, 8, 22));
    data[p * 4 + 3] = Math.round(255 * a);
    if (a > 0.5) {
      const x = p % w, y = (p / w) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const sirkaOrez = maxX - minX + 1, vyskaOrez = maxY - minY + 1;
  await sharp(data, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: minX, top: minY, width: sirkaOrez, height: vyskaOrez })
    .resize({ width: 400 })
    .webp({ quality: 92, alphaQuality: 100 })
    .toFile(`${CIL}/vosk.webp`);

  console.log(`vosk.webp  ořez ${minX},${minY} ${sirkaOrez}x${vyskaOrez}`);
  console.log(`  poměr výška/šířka = ${(vyskaOrez / sirkaOrez * 100).toFixed(1)} %`);
}
