/* Fotky z příběhu a hotel pro web.
 *
 *   node scripts/fotky-web.mjs
 *
 * Originály v public/fotky mají 1600 px a 200–400 kB, hromádka je přitom
 * na telefonu široká kolem 360 px. Skript je zmenší na 900 px (ostré i na
 * hustém displeji) a uloží jako WebP do public/fotky/web. Originály zůstávají,
 */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const PRIBEH = [1, 2, 4, 6, 11, 16, 20, 21, 22, 23, 24, 25, 26, 27, 28];

await mkdir("public/fotky/web", { recursive: true });

for (const n of PRIBEH) {
  await sharp(`public/fotky/${n}.jpeg`)
    .rotate()
    .resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(`public/fotky/web/${n}.webp`);
}

// fotka hotelu na rubu mapy — PNG měl přes megabajt
await sharp("public/fotky/rekovice.png").webp({ quality: 80 }).toFile("public/fotky/rekovice.webp");
