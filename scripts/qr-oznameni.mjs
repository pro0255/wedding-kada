/* QR kód na svatební web pro tištěné oznámení.
 *
 *   node scripts/qr-oznameni.mjs
 *
 * Adresa je tu napsaná natvrdo schválně. Komponenta by si ji mohla vzít
 * z prostředí jako zbytek webu, jenže lokálně se z NEXT_PUBLIC_WEB_URL
 * a VERCEL_PROJECT_PRODUCTION_URL nevybere nic a spadne to na localhost:3000 —
 * a QR s localhostem vytištěný na dvou stech oznámeních je vtip, který nikoho
 * nepobaví.
 *
 * Výstup je SVG, ne PNG: je to vektor, takže v tiskovém PDF zůstane ostrý při
 * jakékoli velikosti a nemusím hlídat 300 dpi.
 *
 * Korekce chyb je na Q (25 %). Na papíře se počítá s tím, že se kód ušpiní,
 * ohne nebo se na něj posvítí pod úhlem; výchozí M by stačilo na obrazovku,
 * ne na kartu, kterou si někdo bude vozit v kapse. */

import QRCode from "qrcode";
import { writeFile, mkdir } from "node:fs/promises";

const ADRESA = "https://wedding-kada.vercel.app";
const CIL = "public/oznameni/qr.svg";

await mkdir("public/oznameni", { recursive: true });

const svg = await QRCode.toString(ADRESA, {
  type: "svg",
  errorCorrectionLevel: "Q",
  /* Bez okraje: odstup řeší CSS na kartě, ať se nemusí počítat dvakrát. */
  margin: 0,
  color: { dark: "#3a3a38", light: "#0000" },
});

await writeFile(CIL, svg);
console.log(`${CIL}  ${ADRESA}  (${(svg.length / 1024).toFixed(1)} kB)`);
