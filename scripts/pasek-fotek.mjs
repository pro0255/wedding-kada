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
 * s rezervou. Ořez se nepočítá přes `fit: cover`, ale ručně: cover umí jen
 * gravitaci (střed, kraj), a tady je potřeba plynulý posun.
 *
 * `position: attention` se nepoužívá schválně — hledá místo s nejvíc detailem
 * a u fotky páru na šířku se zakousne do jednoho obličeje a druhého ustřihne.
 *
 * Jiné fotky = jiná čísla v POUZITE. Soubory se přepíšou, komponenta na ně
 * odkazuje pořadím, ne jménem. */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

/* Fotky z public/fotky, v pořadí na pásku shora dolů.
 *
 * `posun` je posun OBRAZU, ne výřezu: záporný odsune fotku doleva a odkryje
 * tím její pravou stranu, kladný naopak. -1 a 1 jsou krajní polohy, 0 je střed.
 * Výřez uvnitř se proto posouvá opačným směrem, než jak je znaménko psané. */
const POUZITE = [
  { foto: "7", posun: -0.25 },
  { foto: "12", posun: 0.9 },
  { foto: "13", posun: 0.6 },
];

const KAM = "public/oznameni/pasek";
const SIRKA_MM = 41.33;
const VYSKA_MM = 63.3;
const DPI = 300;

const px = (mm) => Math.round((mm / 25.4) * DPI);
const cil = (i) => `${KAM}/${i + 1}.jpg`;

await mkdir(KAM, { recursive: true });

const pomerCile = SIRKA_MM / VYSKA_MM;

for (let i = 0; i < POUZITE.length; i++) {
  const { foto, posun } = POUZITE[i];
  const zdroj = sharp(`public/fotky/${foto}.jpeg`);
  const { width: W, height: H } = await zdroj.metadata();

  /* Největší obdélník cílového poměru, jaký se do předlohy vejde. */
  let sirka = Math.round(H * pomerCile);
  let vyska = H;
  if (sirka > W) { sirka = W; vyska = Math.round(W / pomerCile); }

  /* Volné místo kolem výřezu se rozdělí podle posunu. Bez posunu (0) padne
   * napůl na každou stranu, tedy na střed. */
  const volnoX = W - sirka;
  const volnoY = H - vyska;
  const left = Math.round((volnoX / 2) * (1 - posun));
  const top = Math.round(volnoY / 2);

  const info = await zdroj
    .extract({ left, top, width: sirka, height: vyska })
    .resize(px(SIRKA_MM), px(VYSKA_MM))
    /* Mírné zesvětlení a měkčí kontrast: tisk sytí stíny víc než obrazovka
     * a bez toho by v tmavých místech zmizel detail. */
    .linear(0.94, 10)
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4" })
    .toFile(cil(i));
  console.log(`${cil(i)}  ${info.width} x ${info.height} px, ${(info.size / 1024).toFixed(0)} kB  (z ${foto}.jpeg, posun ${posun})`);
}
