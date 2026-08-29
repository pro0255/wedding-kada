/* Kreslené květinové snítky — náhrada za fotografické pruhy, které se na
   telefonu rozpadly do barevného šumu. Linka drží čitelnost v jakékoli
   velikosti a mluví stejným jazykem jako doodly u příběhu a ikonky u programu.

   Sedm druhů, aby se v pozadí neopakovala pořád ta samá kresba. Všechny
   rostou zdola nahoru ve viewBoxu 64 × 120; barvu, velikost i rozostření
   si řídí obal .kytky-kresba v globals.css přes currentColor.

   POZOR na souřadnice: paty lístků, zrn i větviček nejsou psané od oka, ale
   odečtené ze stonku (getPointAtLength v prohlížeči) a špičky vedou po
   kolmici k němu, skloněné k vrcholu. První verze měla body odhadnuté
   a lístky se stonku ani nedotýkaly. Když se stonek změní, musí se body
   přepočítat znovu — dohadovat je nemá cenu. */

const T = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.1,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/* Lístek jako dva oblouky mezi patou a špičkou. Kolmice k ose určuje, jak
   moc se rozevře do stran — čím menší s, tím útlejší lístek. */
const listek = (x1: number, y1: number, x2: number, y2: number, s = 0.3) => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const nx = -(y2 - y1) * s;
  const ny = (x2 - x1) * s;
  return `M ${x1} ${y1} Q ${mx + nx} ${my + ny}, ${x2} ${y2} Q ${mx - nx} ${my - ny}, ${x1} ${y1} Z`;
};

const kruh = (cx: number, cy: number, r: number) =>
  `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;

const elipsa = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

type Props = { className?: string };

function Svg({ children, className = "" }: Props & { children: React.ReactNode }) {
  return (
    <span className={`kytky-kresba ${className}`} aria-hidden="true">
      <svg viewBox="0 0 64 120" focusable="false">{children}</svg>
    </span>
  );
}

/* snítka s lístky po obou stranách a poupaty na dvou větvičkách u vrcholu */
export function SnitkaListy({ className }: Props) {
  return (
    <Svg className={className}>
      <path {...T} d="M 32 118 C 28 96, 30 70, 36 46 C 40 30, 44 18, 45 9" />
      <path {...T} d={listek(30, 98.2, 16.6, 89.4)} />
      <path {...T} d={listek(30.4, 80.5, 43.3, 72.8)} />
      <path {...T} d={listek(32.5, 62.9, 22.5, 53.1)} />
      <path {...T} d={listek(35.6, 47.7, 47.7, 43)} />
      <path {...T} d={listek(39.5, 32.7, 32.5, 24.3)} />
      <path {...T} d="M 40.7 28.4 L 48 25" />
      <path {...T} d={kruh(49.6, 24.3, 2.4)} />
      <path {...T} d="M 42.9 19.9 L 38.2 13.5" />
      <path {...T} d={kruh(37.2, 12.1, 2.2)} />
      <path {...T} d={kruh(45, 6.6, 2.8)} />
    </Svg>
  );
}

/* stonek se třemi lístky a pětilistým kvítkem posazeným na jeho konci */
export function SnitkaKvet({ className }: Props) {
  return (
    <Svg className={className}>
      <path {...T} d="M 32 118 C 29 92, 31 60, 34 32" />
      <path {...T} d={listek(30.7, 99.1, 17.3, 90.3)} />
      <path {...T} d={listek(30.6, 80.1, 42.3, 72.4)} />
      <path {...T} d={listek(31.4, 62.9, 22, 55.4)} />
      {[0, 72, 144, 216, 288].map((uhel) => (
        <g key={uhel} transform={`rotate(${uhel} 34 32)`}>
          <path {...T} d={elipsa(34, 24, 4.2, 6.6)} />
        </g>
      ))}
      <path {...T} d={kruh(34, 32, 2.8)} />
    </Svg>
  );
}

/* stonek se třemi lístky a dvěma zvonky svěšenými z jeho vrcholu */
export function SnitkaZvonky({ className }: Props) {
  return (
    <Svg className={className}>
      <path {...T} d="M 32 118 C 30 96, 32 70, 37 48 C 40 36, 43 26, 44 16" />
      <path {...T} d={listek(31.3, 97.4, 18.3, 88)} />
      <path {...T} d={listek(32.4, 76.8, 44.6, 69.9)} />
      <path {...T} d={listek(35.3, 56.3, 26.9, 47.8)} />
      <path {...T} d="M 44 16 L 38 24" />
      <path {...T} d="M 38 24 L 33.5 34 Q 38 37.5, 42.5 34 Z" />
      <path {...T} d="M 44 16 L 50 26" />
      <path {...T} d="M 50 26 L 45.5 36 Q 50 39.5, 54.5 36 Z" />
    </Svg>
  );
}

/* tulipán — dva dlouhé listy a kalich ze tří okvětních lístků */
export function SnitkaTulipan({ className }: Props) {
  return (
    <Svg className={className}>
      <path {...T} d="M 32 118 C 30 92, 32 62, 34 38" />
      <path {...T} d={listek(31.2, 98.8, 14.1, 88.4, 0.22)} />
      <path {...T} d={listek(31.4, 81.2, 46, 72.6, 0.22)} />
      {/* kalich stojí na konci stonku (34, 38): prostřední lístek uprostřed,
         dva boční se od něj rozevírají */}
      <path {...T} d="M 34 38 C 27 34, 25 25, 27 18 C 30 22, 33 26, 34 30 C 35 26, 38 22, 41 18 C 43 25, 41 34, 34 38 Z" />
      <path {...T} d="M 34 30 C 33 24, 33.5 19, 34 15 C 34.5 19, 35 24, 34 30" />
    </Svg>
  );
}

/* kopretina — úzké paprsky kolem středu, tři lístky na stonku */
export function SnitkaKopretina({ className }: Props) {
  return (
    <Svg className={className}>
      <path {...T} d="M 32 118 C 31 90, 33 58, 35 34" />
      <path {...T} d={listek(31.8, 94.5, 20.4, 86.3)} />
      <path {...T} d={listek(32.3, 76, 43.3, 68.9)} />
      <path {...T} d={listek(33.2, 59.2, 24.6, 52.3)} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((uhel) => (
        <g key={uhel} transform={`rotate(${uhel} 35 34)`}>
          <path {...T} d={elipsa(35, 25.5, 2.4, 6.4)} />
        </g>
      ))}
      <path {...T} d={kruh(35, 34, 2.6)} />
    </Svg>
  );
}

/* klásek — drobná zrna střídavě po obou stranách stébla */
export function SnitkaKlasek({ className }: Props) {
  return (
    <Svg className={className}>
      <path {...T} d="M 32 118 C 31 92, 33 62, 36 30" />
      <path {...T} d={listek(32.6, 73.9, 29, 67.4, 0.4)} />
      <path {...T} d={listek(33, 66.9, 37.4, 60.8, 0.4)} />
      <path {...T} d={listek(33.5, 59.9, 30, 53.2, 0.4)} />
      <path {...T} d={listek(34, 52.8, 38.5, 46.8, 0.4)} />
      <path {...T} d={listek(34.6, 45.8, 31.2, 39.1, 0.4)} />
      <path {...T} d={listek(35.2, 38.8, 39.7, 32.8, 0.4)} />
      <path {...T} d={listek(36, 30, 36, 20, 0.35)} />
    </Svg>
  );
}

/* zavřené poupě na prohnutém stonku */
export function SnitkaPoupe({ className }: Props) {
  return (
    <Svg className={className}>
      <path {...T} d="M 32 118 C 34 94, 30 66, 33 42 C 35 30, 38 22, 39 14" />
      <path {...T} d={listek(32.3, 86.6, 19.6, 78.6)} />
      <path {...T} d={listek(31.9, 60.4, 42.7, 53.3)} />
      {/* kalíšek objímá spodek poupěte, samo poupě je špičatá kapka */}
      <path {...T} d="M 39 14 C 34 12, 32 6, 34 1 C 37 3, 39 6, 39 10 C 39 6, 41 3, 44 1 C 46 6, 44 12, 39 14 Z" />
      <path {...T} d="M 36.5 14.5 C 37 18, 38.5 19.5, 39 21 C 39.5 19.5, 41 18, 41.5 14.5" />
    </Svg>
  );
}
