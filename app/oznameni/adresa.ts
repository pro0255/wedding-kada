/* Adresa svatebního webu na jednom místě.
 *
 * Bere se odsud dvakrát: tiskne se na QR kartičku jako čitelný text a zároveň
 * z ní scripts/qr-oznameni.mjs generuje QR kód. Kdyby byla na dvou místech,
 * jednou by se změnila a podruhé ne — a na kartě by byl kód mířící jinam, než
 * co je pod ním napsané.
 *
 * Až bude vlastní doména, přepiš tenhle řádek a spusť:
 *
 *   node scripts/qr-oznameni.mjs
 *
 * Adresa je bez „https://“ — na kartě se tiskne, jak ji člověk napíše do
 * prohlížeče. Protokol si k ní přidá WEB_URL pro QR kód. */
export const WEB_ADRESA = "wedding-kada.vercel.app";

export const WEB_URL = `https://${WEB_ADRESA}`;
