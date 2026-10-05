/* Věnec kolem scény příběhu.
 *
 *   node scripts/kytky-venec.mjs
 *
 * Předlohy v public/kytky u obalky jsou dvě hotové vrstvy věnce na stejném
 * plátně 1622 × 1001 s průhledným pozadím: zadní leží za fotkami s obálkou,
 * přední přes ně. Skript je jen převede do WebP — PNG mají dohromady přes
 * megabajt, což je na jednu sekci webu moc.
 *
 * Nic se v nich nepřekresluje ani neposouvá. Obě musí zůstat na tomtéž plátně
 * a ve stejném měřítku, protože na stránce leží přesně přes sebe a scéna je do
 * nich usazená v procentech. */

import sharp from "sharp";

const SLOZKA = "public/kytky u obalky";
const CIL = "public/kytky";

const VRSTVY = [
  { zdroj: `${SLOZKA}/vrstva_zadni_1622x1001.png`, cil: "venec-pod" },
  { zdroj: `${SLOZKA}/vrstva_predni_1622x1001_v2.png`, cil: "venec-nad" },
];

/* Šířka výstupu. Scéna je na webu široká přesně jako plátno předlohy, tedy
 * 1622 px, takže se nesmí ukládat menší — v 1500 px se na stránce roztahovala
 * o osm procent a věnec byl rozmazaný. */
const SIRKA = 1622;

/* Přesuny jednotlivých květů v předloze. Teď je seznam prázdný — přední vrstva
 * se místo toho na stránce lehce naklání, což vyšlo líp: květy se tím na fotkách
 * zvednou a na obálce klesnou naráz, bez zásahu do kresby.
 *
 * Kdyby přesun byl přece jen potřeba, květ se najde jako souvislý ostrov, jehož
 * střed padne do zadané oblasti; zadávat rovnou obdélník pixelů by při změně
 * předlohy ustřihlo okvětní lístek. Vše v dílech šířky a výšky plátna. */
const POSUNY = [];

/* Vrátí data vrstvy s přesunutými květy podle POSUNY. */
async function posun(zdroj, jmeno) {
  const ukoly = POSUNY.filter((u) => u.vrstva === jmeno);
  if (!ukoly.length) return sharp(zdroj);

  const { data, info } = await sharp(zdroj).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;

  /* souvislé ostrovy neprůhledných pixelů */
  const cislo = new Int32Array(W * H);
  const ostrovy = [];
  for (let start = 0; start < W * H; start++) {
    if (cislo[start] || data[start * 4 + 3] < 40) continue;
    const id = ostrovy.length + 1;
    const zasobnik = [start];
    cislo[start] = id;
    let sx = 0, sy = 0, pocet = 0;
    while (zasobnik.length) {
      const q = zasobnik.pop();
      const qx = q % W, qy = (q / W) | 0;
      sx += qx; sy += qy; pocet++;
      const sousedi = [
        qx > 0 ? q - 1 : -1, qx < W - 1 ? q + 1 : -1,
        qy > 0 ? q - W : -1, qy < H - 1 ? q + W : -1,
      ];
      for (const n of sousedi) {
        if (n < 0 || cislo[n] || data[n * 4 + 3] < 40) continue;
        cislo[n] = id;
        zasobnik.push(n);
      }
    }
    ostrovy.push({ id, x: sx / pocet / W, y: sy / pocet / H, pocet });
  }

  const ven = Buffer.alloc(W * H * 4);
  const stehovane = new Map();
  for (const u of ukoly) {
    const kus = ostrovy
      .filter((o) => o.pocet > (W * H) / 3000)
      .find((o) => Math.hypot(o.x - u.kolem.x, o.y - u.kolem.y) < u.kolem.r);
    if (!kus) throw new Error(`v ${jmeno} jsem u ${u.kolem.x}/${u.kolem.y} žádný květ nenašel`);
    stehovane.set(kus.id, u);
    console.log(`  posouvám květ u ${kus.x.toFixed(2)}/${kus.y.toFixed(2)} o ${u.dx}/${u.dy}`);
  }

  /* co se nestěhuje, zůstává; zbytek se překreslí na novém místě */
  for (let p = 0; p < W * H; p++) {
    if (data[p * 4 + 3] < 40 || stehovane.has(cislo[p])) continue;
    ven.set(data.subarray(p * 4, p * 4 + 4), p * 4);
  }
  for (const [id, u] of stehovane) {
    const posunX = Math.round(u.dx * W), posunY = Math.round(u.dy * H);
    for (let p = 0; p < W * H; p++) {
      if (cislo[p] !== id) continue;
      const x = (p % W) + posunX, y = ((p / W) | 0) + posunY;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      ven.set(data.subarray(p * 4, p * 4 + 4), (y * W + x) * 4);
    }
  }
  return sharp(ven, { raw: { width: W, height: H, channels: 4 } });
}

let rozmer = null;
for (const { zdroj, cil } of VRSTVY) {
  const vstup = await sharp(zdroj).metadata();
  const popis = `${vstup.width}x${vstup.height}`;
  if (rozmer && rozmer !== popis) {
    throw new Error(`vrstvy musí mít stejné plátno, ale mám ${rozmer} a ${popis}`);
  }
  rozmer = popis;

  const vysledek = await (await posun(zdroj, zdroj.split("/").pop()))
    .resize({ width: SIRKA, withoutEnlargement: true })
    .webp({ quality: 95, alphaQuality: 100 })
    .toFile(`${CIL}/${cil}.webp`);

  console.log(
    `${CIL}/${cil}.webp  ${popis} → ${vysledek.width}x${vysledek.height}, `
    + `${(vysledek.size / 1024).toFixed(0)} kB`,
  );
}
console.log(`poměr stran plátna = ${rozmer.replace("x", " / ")}`);
