/**
 * Úklid testovacích dat z příkazové řádky — totéž co tlačítko v /admin
 * (lib/uklid.ts): skóre her, jména hostů, fotky s lajky (i v Cloudinary)
 * a počítadla pokusů. Rezervace ubytování se nemažou.
 *
 * Bez --ostre nic nemaže, jen vypíše, co by smazal:
 *   node --env-file=.env.local scripts/uklid.mjs
 *   node --env-file=.env.local scripts/uklid.mjs --ostre
 */
import { prehledUklidu, uklid } from "../lib/uklid.ts";

const ostre = process.argv.includes("--ostre");
const p = ostre ? await uklid() : await prehledUklidu();

console.log(ostre ? "Smazáno:" : "Smazalo by se (spusť s --ostre):");
for (const [hra, n] of Object.entries(p.skore)) console.log(`  skóre ${hra}: ${n}`);
console.log(`  jména hostů: ${p.jmena}`);
console.log(`  fotky a videa (i v Cloudinary): ${p.fotky}`);
console.log(`  lajky: ${p.lajky}`);
console.log("  počítadla pokusů u vstupu: všechna");
