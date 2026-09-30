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
  { zdroj: `${SLOZKA}/vrstva_predni_1622x1001.png`, cil: "venec-nad" },
];

/* Šířka výstupu. Scéna je na webu široká nanejvýš kolem 1100 px, tohle je
 * rezerva na displeje s vyšší hustotou. */
const SIRKA = 1500;

let rozmer = null;
for (const { zdroj, cil } of VRSTVY) {
  const vstup = await sharp(zdroj).metadata();
  const popis = `${vstup.width}x${vstup.height}`;
  if (rozmer && rozmer !== popis) {
    throw new Error(`vrstvy musí mít stejné plátno, ale mám ${rozmer} a ${popis}`);
  }
  rozmer = popis;

  const vysledek = await sharp(zdroj)
    .resize({ width: SIRKA, withoutEnlargement: true })
    .webp({ quality: 88, alphaQuality: 100 })
    .toFile(`${CIL}/${cil}.webp`);

  console.log(
    `${CIL}/${cil}.webp  ${popis} → ${vysledek.width}x${vysledek.height}, `
    + `${(vysledek.size / 1024).toFixed(0)} kB`,
  );
}
console.log(`poměr stran plátna = ${rozmer.replace("x", " / ")}`);
