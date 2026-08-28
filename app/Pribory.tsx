/* Nepoužité: komponenta se zatím nikde nevykresluje, schovaná pro případ,
   že by se příbory k menu měly vrátit (import + <Vidlicka/Nuz/Lzice> do
   .menu-karta v app/page.tsx, styly .menu-pribor už v globals.css jsou).

   Ozdobné příbory po stranách svatebního menu — vidlička vlevo, vpravo blíž
   k menu nůž a za ním lžíce. Kresba vychází z rytiny starého stříbra:
   hlava (hroty / miska / čepel), dlouhý štíhlý krk s růžicí a dole barokní
   koncovka — vykrajovaný obrys se závitnicí, uvnitř štítek s růží a na
   samém konci hrozníček kytiček s nožičkou.

   Všechny tři jsou souměrné podle svislé osy, tak se kreslí jen levá polovina
   a druhá se zrcadlí přes <g transform="translate(120 0) scale(-1 1)">
   (x → 120 − x, osa x=60 zůstává na místě). Držadlo i zdobení jsou pro
   všechny tři stejné, liší se jen hlava — proto jsou to společné konstanty.

   Souřadnice jsou v jednotkách viewBoxu (120 × 780), velikost a poloha se
   řídí v CSS přes .menu-pribor. */

const P = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/* tenčí tah na drobné zdobení, ať nepřebije hlavní obrys */
const TENKY = { ...P, strokeWidth: 1.4 };

const kruh = (cx: number, cy: number, r: number) =>
  `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;

/* Levá polovina držadla: od krčku (52, 314) štíhlým dříkem dolů, pak se
   rozšíří do koncovky — závitnice, největší vyboulení, zaškrcení, druhé
   vyboulení a špička na ose (60, 742). */
const DRZADLO =
  "M 52 314 C 51 370, 50 430, 49 486 C 48 512, 46 528, 45 542 C 38 546, 33 554, 34 568 C 35 582, 31 592, 30 606 C 29 622, 36 630, 39 640 C 34 652, 31 666, 33 682 C 35 700, 43 716, 49 726 C 53 732, 57 738, 60 742";

/* vnitřní štítek — kopíruje obrys o kus dovnitř, jako rytina na stříbře */
const STITEK =
  "M 55 502 C 54 522, 52 536, 51 550 C 45 556, 41 563, 42 575 C 43 587, 40 597, 40 609 C 40 623, 46 632, 48 643 C 44 655, 42 668, 43 682 C 45 698, 52 712, 60 720";

/* hlavy jednotlivých příborů — vždy levá polovina od krčku (52, 314) nahoru */

/* Vidlička: hroty se sbíhají do špiček a mají mezi sebou široké zářezy.
   Rozvržení napříč: hrot 24–36, zářez 36–44, hrot 44–56, prostřední
   zářez 56–64 (a zrcadlově). Hlava tak měří 72 jednotek. */
const VIDLICKA =
  "M 52 314 C 46 300, 26 290, 24 252 C 22 210, 22 130, 30 64 C 34 100, 36 140, 36 192 C 36 200, 44 200, 44 192 C 44 140, 46 100, 50 58 C 54 100, 56 140, 56 192 C 56 200, 58 202, 60 202";

/* lžíce: vejčitá miska, nejširší nad polovinou; horní část drží šířku výš
   a zaobluje se až těsně pod vrcholem, aby vršek nevybíhal do špičky */
const LZICE =
  "M 52 314 C 43 306, 21 302, 11 282 C -3 250, -3 192, 6 140 C 14 104, 27 84, 41 71 C 49 67, 55 65, 60 65";

/* Nůž podle siluety příborového nože: čepel se zakulacenou špičkou.
   PRAVÁ hrana je rovná úsečka (x = 84 od y = 118 dolů), LEVÁ se vyklenuje —
   nůž stojí vpravo od menu, takže se břicho čepele vyboulí směrem k němu.
   Nejširší je ve spodní třetině. Čára není uzavřená (žádné Z): začíná i končí
   na horních rozích držadla — vlevo (68, 314), vpravo (84, 314) — takže obrys
   plynule přejde do násady stejně jako u vidličky a lžíce. Uzavřený tvar tam
   dělal příčku, kterou ostatní příbory nemají.
   Souměrná není, kreslí se celá (viz hlavaSoumerna). */
const NUZ =
  "M 68 314 C 46 313, 24 308, 21 280 C 18 230, 19 184, 26 144 C 33 102, 52 74, 72 58 C 80 80, 84 98, 84 122 L 84 314";

/** Vykreslí obsah dvakrát — podruhé zrcadlově, takže stačí kreslit levou půlku. */
function Zrcadlo({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <g transform="translate(120 0) scale(-1 1)">{children}</g>
    </>
  );
}

function Pribor({
  hlava,
  trida,
  popis,
  doplnky,
  hlavaSoumerna = true,
  posunDrzadla = 0,
}: {
  hlava: string;
  trida: string;
  popis: string;
  /* Doplňky hlavy, které nejsou součástí jejího obrysu — třeba vějíř
     u vidličky. Stínování ani šrafy tu nejsou: kresba má být jen čistá
     kontura. Kreslí se BEZ zrcadlení, co má být souměrné, si příbor
     obalí <Zrcadlo> sám. */
  doplnky?: React.ReactNode;
  /* false u nože — jeho čepel má každou stranu jinou, takže se nezrcadlí */
  hlavaSoumerna?: boolean;
  /* Posun držadla i s koncovkou do strany. Nůž ho má o 16 vpravo, aby pravá
     strana držadla navazovala na rovnou hranu čepele (x = 84). Osa zrcadlení
     se posune spolu s ním, takže koncovka zůstane souměrná sama v sobě. */
  posunDrzadla?: number;
}) {
  return (
    <span className={`menu-pribor ${trida}`} aria-hidden="true">
      <svg viewBox="0 0 120 780" role="img" aria-label={popis} focusable="false">
        <g transform={posunDrzadla ? `translate(${posunDrzadla} 0)` : undefined}>
          <Zrcadlo>
            {hlavaSoumerna && <path {...P} d={hlava} />}
            <path {...P} d={DRZADLO} />
            <path {...TENKY} d={STITEK} />
            {/* závitnice v rameni koncovky */}
            <path {...TENKY} d="M 45 546 C 39 552, 37 560, 40 566 C 43 570, 47 567, 46 562" />
          </Zrcadlo>

          {/* růžice v krčku */}
          <path {...P} d={kruh(60, 340, 6)} />
          <path {...TENKY} d={kruh(60, 340, 2.5)} />

          {/* růže uprostřed štítku */}
          <path {...P} d={kruh(60, 600, 10)} />
          <path {...TENKY} d="M 55 602 C 55 595, 65 595, 64 602 C 63 608, 57 608, 57 603" />

          {/* list pod růží */}
          <path {...TENKY} d="M 60 622 C 53 638, 52 662, 60 680 C 68 662, 67 638, 60 622 Z" />

          {/* hrozníček kytiček na konci a nožička */}
          <path {...P} d={kruh(52, 702, 6.5)} />
          <path {...P} d={kruh(68, 702, 6.5)} />
          <path {...P} d={kruh(60, 716, 6.5)} />
          <path {...TENKY} d={kruh(60, 734, 3.5)} />
        </g>

        {!hlavaSoumerna && <path {...P} d={hlava} />}
        {doplnky}
      </svg>
    </span>
  );
}

export function Vidlicka() {
  return (
    <Pribor
      hlava={VIDLICKA}
      trida="menu-pribor-vidlicka"
      popis="Vidlička"
      /* Vějíř, kterým hlava přechází do krku. Není to stínování, ale součást
         tvaru — proto zůstává, zatímco u nože a lžíce šrafy pryč jsou. */
      doplnky={
        <Zrcadlo>
          <path {...TENKY} d="M 30 240 C 33 266, 40 288, 47 302" />
          <path {...TENKY} d="M 40 236 C 42 262, 46 284, 50 300" />
          <path {...TENKY} d="M 50 234 C 51 260, 53 282, 55 298" />
        </Zrcadlo>
      }
    />
  );
}

export function Lzice() {
  return (
    <Pribor
      hlava={LZICE}
      trida="menu-pribor-lzice"
      popis="Lžíce"
    />
  );
}

export function Nuz() {
  return (
    <Pribor
      hlava={NUZ}
      trida="menu-pribor-nuz"
      popis="Nůž"
      hlavaSoumerna={false}
      posunDrzadla={16}
    />
  );
}
