/* QR kód na svatební web pro tištěné oznámení.
 *
 *   node scripts/qr-oznameni.mjs
 *
 * Adresa se bere z app/oznameni/adresa.ts, odkud ji čte i kartička, na které
 * je vytištěná pod kódem. Z prostředí jako zbytek webu ji brát nejde: lokálně
 * se z NEXT_PUBLIC_WEB_URL ani VERCEL_PROJECT_PRODUCTION_URL nevybere nic
 * a spadlo by to na localhost:3000 — a QR s localhostem vytištěný na dvou stech
 * oznámeních je vtip, který nikoho nepobaví.
 *
 * Výstup je SVG, ne PNG: je to vektor, takže v tiskovém PDF zůstane ostrý při
 * jakékoli velikosti a nemusím hlídat 300 dpi.
 *
 * Korekce chyb je na Q (25 %). Na papíře se počítá s tím, že se kód ušpiní,
 * ohne nebo se na něj posvítí pod úhlem; výchozí M by stačilo na obrazovku,
 * ne na kartu, kterou si někdo bude vozit v kapse. */

import QRCode from "qrcode";
import { writeFile, mkdir } from "node:fs/promises";
import { WEB_URL } from "../app/oznameni/adresa.ts";

const CIL = "public/oznameni/qr.svg";

await mkdir("public/oznameni", { recursive: true });

const svg = await QRCode.toString(WEB_URL, {
  type: "svg",
  errorCorrectionLevel: "Q",
  /* Bez okraje: odstup řeší CSS na kartě, ať se nemusí počítat dvakrát. */
  margin: 0,
  color: { dark: "#3a3a38", light: "#0000" },
});

await writeFile(CIL, svg);
console.log(`${CIL}  ${WEB_URL}  (${(svg.length / 1024).toFixed(1)} kB)`);
