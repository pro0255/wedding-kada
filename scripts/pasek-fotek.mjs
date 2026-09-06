/* Fotky pro pásek na oznámení.
 *
 *   node scripts/pasek-fotek.mjs
 *
 * Bere tři fotky z galerie a dělá z nich výřezy na výšku, jeden pod druhý jako
 * z fotoautomatu. Barevné, ne černobílé.
 *
 * Rozměr vychází z archu: proužky se tisknou po třech na jednu A5 a řežou se
 * z ní. Šířka proužku je 148 / 3 = 49,33 mm, po 4 mm bílého okraje z každé
 * strany zbyde na fotku 41,33 mm. Výška je dopočítaná tak, aby tři fotky
 * s pěti milimetry mezi sebou a nahoře i dole vyplnily 210 mm.
 *
 * Výřez je na 300 dpi. Předlohy jsou fotky z mobilu, takže rozlišení mají
 * s rezervou. Ořezává se `fit: cover` na střed — ne přes `position: attention`.
 * Ta hledá místo s nejvíc detailem a u fotky páru na šířku se zakousne do
 * jednoho obličeje a druhého ustřihne. Na střed jsou oba.
 *
 * Jiné fotky = jiná čísla v POUZITE. Soubory se přepíšou, komponenta na ně
 * odkazuje pořadím, ne jménem. */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

/* Čísla z public/fotky. Pořadí je pořadí na pásku, shora dolů. */
const POUZITE = ["7", "12", "13"];

const KAM = "public/oznameni/pasek";
const SIRKA_MM = 41.33;
const VYSKA_MM = 63.3;
const DPI = 300;

const px = (mm) => Math.round((mm / 25.4) * DPI);

await mkdir(KAM, { recursive: true });

for (let i = 0; i < POUZITE.length; i++) {
  const cil = `${KAM}/${i + 1}.jpg`;
  const info = await sharp(`public/fotky/${POUZITE[i]}.jpeg`)
    .resize(px(SIRKA_MM), px(VYSKA_MM), { fit: "cover" })
    /* Mírné zesvětlení a měkčí kontrast: tisk sytí stíny víc než obrazovka
     * a bez toho by v tmavých místech zmizel detail. */
    .linear(0.94, 10)
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toFile(cil);
  console.log(`${cil}  ${info.width} x ${info.height} px, ${(info.size / 1024).toFixed(0)} kB  (z ${POUZITE[i]}.jpeg)`);
}
