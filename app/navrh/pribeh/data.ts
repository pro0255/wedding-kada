/* Data příběhu pro návrhy — kopie z app/page.tsx. `popis` je krátký popisek
   fotky (místo / událost) jako text, ne obrázek. Data u fotek nemáme, proto
   se nevymýšlejí — pořadí fotek je chronologické. */
export type Fotka = { src: string; popis: string };

export const FOTKY: Fotka[] = [
  { src: "/fotky/web/2.webp", popis: "První společná fotka" },
  { src: "/fotky/web/27.webp", popis: "ZOO Ostrava" },
  { src: "/fotky/web/28.webp", popis: "Bílovec" },
  { src: "/fotky/web/4.webp", popis: "Chorvatsko" },
  { src: "/fotky/web/6.webp", popis: "Kozmice" },
  { src: "/fotky/web/11.webp", popis: "Sicílie" },
  { src: "/fotky/web/21.webp", popis: "Svatba I & O" },
  { src: "/fotky/web/16.webp", popis: "Těhotenské focení" },
  { src: "/fotky/web/22.webp", popis: "První Chorvatsko jako rodina" },
  { src: "/fotky/web/20.webp", popis: "Slovensko" },
  { src: "/fotky/web/23.webp", popis: "Štramberk" },
  { src: "/fotky/web/24.webp", popis: "FM City Fest" },
  { src: "/fotky/web/25.webp", popis: "Trogir" },
  { src: "/fotky/web/1.webp", popis: "Zásnuby na Troskách" },
  { src: "/fotky/web/26.webp", popis: "Kutná Hora" },
];

// text dopisu — beze změny z webu
export const DOPIS =
  "Pět let spolu, jedno zásnubní „ano“ na Troskách a teď nás čeká naše největší společné dobrodružství. Poznali jsme se, zamilovali se, prošli spolu krásnými i náročnějšími chvílemi a vybudovali domov plný smíchu, lásky a společných vzpomínek. Dnes už víme, že chceme jít životem bok po boku — a proto si 18. září 2027 řekneme své „ano“.";

// dopis rozdělený na věty — pro varianty, které příběh vyprávějí po kouscích
export const VETY = [
  "Pět let spolu, jedno zásnubní „ano“ na Troskách a teď nás čeká naše největší společné dobrodružství.",
  "Poznali jsme se, zamilovali se,",
  "prošli spolu krásnými i náročnějšími chvílemi",
  "a vybudovali domov plný smíchu, lásky a společných vzpomínek.",
  "Dnes už víme, že chceme jít životem bok po boku —",
  "a proto si 18. září 2027 řekneme své „ano“.",
];
