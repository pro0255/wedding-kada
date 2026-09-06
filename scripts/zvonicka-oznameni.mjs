/* Akvarel zvoničky pro tištěné oznámení.
 *
 *   node scripts/zvonicka-oznameni.mjs
 *
 * Předloha je malba v public/fotky/oznámení/ghg.png — zvonička v Rekovicích
 * i s kapličkou, kytkami a kopci za tím. Na kartu se z ní vyřízne svislý pruh
 * se zvoničkou a kapličkou a udělají se dvě věci, bez kterých by to na papíře
 * bylo vidět jako nalepený obdélník:
 *
 * 1. Papír malby je krémový (251, 243, 233), papír karty skoro bílý
 *    (#fbfaf8). Rozdíl je malý, ale na ploše obdélníku ho oko chytí okamžitě.
 *    Barvy se proto po kanálech přepočítají tak, aby krémová vyšla přesně na
 *    barvu karty. Je to jen mírné vyvážení bílé, vztahy mezi barvami zůstanou.
 *
 * 2. Levý a horní okraj se rozpouštějí do průhledna. Bez toho by i po srovnání
 *    papíru byla vidět hrana — malba má u kraje jiný šum a nádech než hladká
 *    plocha karty. Nahoře je přechod nejširší, tam malba mizí za jménem.
 *
 * Vpravo a dole se nerozpouští nic: tam obraz vybíhá přes ořez ven z karty,
 * takže žádná hrana nevznikne. Rozpustit ho tam by naopak nechalo u kraje
 * bledý pruh.
 *
 * Nepřepočítává se to přes „un-multiply“ jako u pásu kytek — tady se nic
 * nevyřezává z bílé, jen se skládá průhlednost přes celou plochu. */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const PREDLOHA = "public/fotky/oznámení/ghg.png";
const CIL = "public/oznameni/zvonicka.png";

/* Výřez je vysoký a úzký: na kartě jde odspodu nahoru až k „Kateřině“, takže
 * poměr stran musí sedět na 62 × 158 mm. Kaplička se vpravo uřízne schválně —
 * pokračuje ven přes okraj karty. Dole to končí nad židlemi; uříznuté židle
 * vypadají jako uříznuté židle, ne jako svatba. */
const VYREZ = { left: 267, top: 230, width: 486, height: 1240 };

/* Cílová šířka na kartě a tiskové rozlišení. Výřez má v předloze jen 486 px,
 * což je na 62 mm sotva 200 dpi, a předloha širší není. Zvětšuje se proto
 * lanczosem na 300 dpi. U měkkého akvarelu to projde — nejsou v něm ostré
 * hrany ani text, které by se zvětšením rozpadly, jen rozpité plochy. Kdyby
 * to byla perovka nebo fotka, tohle by se dělat nesmělo. */
const SIRKA_MM = 62;
const DPI = 300;

/* Krémová malby a bílá karty. Rozdíl srovná zisk po kanálech. */
const PAPIR_MALBY = [251, 243, 233];
const PAPIR_KARTY = [251, 250, 248];

/* Šířka přechodu do průhledna, jako podíl strany. Vpravo a dole nula — tam
 * obraz vybíhá ven přes ořez. */
const PRECHOD = { vlevo: 0.2, vpravo: 0, nahore: 0.15, dole: 0 };

/** Plynulý náběh 0 → 1, bez zlomu na koncích (smoothstep). */
const nabeh = (t) => {
  if (!Number.isFinite(t)) return 1; // nulová šířka přechodu = žádný přechod
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

const { data, info } = await sharp(PREDLOHA).extract(VYREZ).ensureAlpha().raw()
  .toBuffer({ resolveWithObject: true });
const { width: W, height: H } = info;

const zisk = PAPIR_KARTY.map((k, i) => k / PAPIR_MALBY[i]);

const ven = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  const svisle = Math.min(
    nabeh(y / (H * PRECHOD.nahore)),
    nabeh((H - 1 - y) / (H * PRECHOD.dole)),
  );
  for (let x = 0; x < W; x++) {
    const vodorovne = Math.min(
      nabeh(x / (W * PRECHOD.vlevo)),
      nabeh((W - 1 - x) / (W * PRECHOD.vpravo)),
    );
    const i = (y * W + x) * 4;
    for (let c = 0; c < 3; c++) ven[i + c] = Math.min(255, Math.round(data[i + c] * zisk[c]));
    ven[i + 3] = Math.round(255 * svisle * vodorovne);
  }
}

await mkdir("public/oznameni", { recursive: true });
const vysledek = await sharp(ven, { raw: { width: W, height: H, channels: 4 } })
  .resize({ width: Math.round((SIRKA_MM / 25.4) * DPI), kernel: "lanczos3" })
  /* Paleta místo plné barevné hloubky: 2,9 MB -> 0,5 MB. Akvarel má měkké
   * plochy bez ostrých přechodů, takže se na 256 barvách nerozpadne. */
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toFile(CIL);

console.log(
  `${CIL}  ${vysledek.width} x ${vysledek.height} px, ${(vysledek.size / 1024).toFixed(0)} kB` +
    `  (na ${SIRKA_MM} mm šířky to je ${Math.round((vysledek.width / SIRKA_MM) * 25.4)} dpi,` +
    ` poměr stran 1 : ${(vysledek.height / vysledek.width).toFixed(3)})`,
);
