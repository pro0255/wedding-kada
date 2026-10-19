/* Květiny na stole kolem knihy — skutečné svatební květiny (public/kytky),
   v pravých barvách. Souřadnice jsou ve stejných jednotkách jako kniha
   (šířka desky = 1): zavřená kniha leží na x 0…1, otevřená deska dopadne
   na x −1…0, výška knihy je z −0,71…0,71 (záporné z = dál od diváka).

   Kompozice jako u svatebního flat lay: dva shluky po úhlopříčce (vpravo
   za knihou, vlevo před ní) a pár drobností. Hortenzie je zasunutá pod roh
   desek, hledík vykoukne zpod otevřené desky. Leží na stole, takže text
   menu nikdy nezakryjí — kniha je vždy nad nimi.

   vrstva = pořadí odspodu, vyska = jak „vysoká“ je květina (posun stínu). */

export type Kvet = {
  soubor: string;
  x: number;
  z: number;
  sirka: number;
  uhel: number;
  vrstva: number;
  vyska: number;
};

export const KVETINY: Kvet[] = [
  // vpravo za knihou
  { soubor: "04_gypsophila.webp", x: 1.4, z: -0.86, sirka: 0.36, uhel: 2.3, vrstva: 0, vyska: 0.3 },
  { soubor: "12_ostrozka_modra.webp", x: 1.2, z: -0.22, sirka: 0.15, uhel: -0.5, vrstva: 1, vyska: 0.6 },
  { soubor: "06_hortenzie.webp", x: 1.02, z: -0.8, sirka: 0.5, uhel: 0.35, vrstva: 2, vyska: 1.2 },
  { soubor: "09_pivonka.webp", x: 1.3, z: -0.5, sirka: 0.4, uhel: -0.5, vrstva: 3, vyska: 1.3 },
  { soubor: "4_karafiat_broskvovy.webp", x: 0.72, z: -0.93, sirka: 0.3, uhel: 0.9, vrstva: 4, vyska: 1 },
  // vlevo před knihou, u rohu otevřené desky
  { soubor: "03_hledik.webp", x: -1.12, z: 0.22, sirka: 0.14, uhel: 0.25, vrstva: 5, vyska: 0.6 },
  { soubor: "6_pomnenky.webp", x: -0.46, z: 0.88, sirka: 0.19, uhel: 1.35, vrstva: 6, vyska: 0.4 },
  { soubor: "1_karafiat_ruzovy.webp", x: -1.24, z: 0.56, sirka: 0.32, uhel: -0.3, vrstva: 7, vyska: 1 },
  { soubor: "pivonka_zluta (1).webp", x: -1.0, z: 0.84, sirka: 0.42, uhel: 0.4, vrstva: 8, vyska: 1.3 },
  { soubor: "10_gerbera.webp", x: -0.7, z: 0.95, sirka: 0.3, uhel: -0.2, vrstva: 9, vyska: 0.8 },
  // drobnosti
  { soubor: "2_kopretina.webp", x: 0.4, z: 0.9, sirka: 0.15, uhel: 0.6, vrstva: 10, vyska: 0.6 },
  { soubor: "3_krasenka_modra.webp", x: -0.4, z: -0.9, sirka: 0.17, uhel: -0.8, vrstva: 11, vyska: 0.6 },
];
