"use client";

import { useEffect, useRef, useState } from "react";

/* Linkové ikony k programu dne — tenká čárová kresba, jedna ikona na bod
   programu. V klidu jsou neviditelné; na hover karty se samy „dokreslí"
   (stroke-draw přes stroke-dashoffset, proto má každá čára pathLength=1
   a kreslí se jen <path>) a rozpohybují. Pohyby jedou v CSS (globals.css,
   prefix pi-). Na dotykových zařízeních se ikona rozbalí klepnutím na kartu.

   POZOR: dokreslování jede na <path> přes transition, ne animation — na týchž
   elementech totiž visí pohybové animace přes třídy pi-*, a dvě `animation`
   na jednom elementu by si navzájem přepsaly.

   POZOR 2: CSS transform animace přepíše atribut transform na témže elementu,
   proto animované skupiny nikdy nenesou polohovací translate. */

export type IkonaTyp =
  | "snidane"
  | "obrad"
  | "foceni"
  | "pripitek"
  | "dort"
  | "tanec"
  | "odpoledne"
  | "party";

const T = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  pathLength: 1,
};

/* kružnice a elipsa jako path — kvůli stroke-draw efektu (pathLength na
   <circle>/<ellipse> neumí starší Safari/Chrome) */
const kruh = (cx: number, cy: number, r: number) =>
  `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;

const elipsa = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

/* Silueta prstenu i s bokem — horní obruč, boky a spodní obruč jako jeden
   uzavřený tvar. Používají ji masky u obřadu, aby se za prstýnkem schovalo
   všechno, ne jen jeho čáry. */
const PRSTEN_SILUETA =
  "M -28 0 A 28 15 0 0 1 28 0 L 28 11 A 28 15 0 0 1 -28 11 Z";

const srdce = (x: number, y: number, s = 1) =>
  `M ${x} ${y} c ${-1.5 * s} ${-4 * s} ${-8 * s} ${-4 * s} ${-8 * s} ${s} c 0 ${4 * s} ${5 * s} ${7 * s} ${8 * s} ${10 * s} c ${3 * s} ${-3 * s} ${8 * s} ${-6 * s} ${8 * s} ${-10 * s} c 0 ${-5 * s} ${-6.5 * s} ${-5 * s} ${-8 * s} ${-s} Z`;

/* bublinka v nápoji — plná tečka, proto se nedokresluje, jen probublá */
function Bublina({
  cx,
  cy,
  r,
  cls = "",
}: {
  cx: number;
  cy: number;
  r: number;
  cls?: string;
}) {
  return (
    <circle
      className={`pi-bublina ${cls}`}
      cx={cx}
      cy={cy}
      r={r}
      fill="currentColor"
      stroke="none"
    />
  );
}

/* Odstup ikony od konce textu v px. Většině stačí základních 8; snídaně
   a přípitek mají víc, aby hrnek ani sklenky neseděly textu na paty.

   Obě hodnoty jsou doladěné na konkrétní místo v textu nad nimi: hrnek má
   stát pod „N“ ve slově DNE v nadpisu sekce, sklenky pod slovy „budeme
   ukazovat“ o řádek výš. Měřeno na 1200px okně — mění se jen tehdy, když se
   text přelomí jinak. */
const MEZERA: Partial<Record<IkonaTyp, number>> = {
  snidane: 58,
  pripitek: 43,
  dort: 68,
  tanec: 38,
  odpoledne: 38,
  party: 38,
};

const IKONY: Record<IkonaTyp, React.ReactNode> = {
  /* Šálek kávy na podšálku, nad ním stoupají tři pramínky páry. Podšálek je
     uzavřená elipsa, která jde za hrnek — dřív to byl jen oblouk pod ním
     a talířek vypadal nedokreslený. */
  snidane: (
    <>
      {/* Podšálek jde ZA hrnek — maska ho ořízne siluetou šálku i ucha, jinak
         by mu zadní obruč prosvítala skrz. Tah kolem siluety drží mezeru,
         aby se čáry nedotýkaly. */}
      <defs>
        <mask
          id="pi-snidane-talir"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="220"
          height="110"
        >
          <rect x="0" y="0" width="220" height="110" fill="#fff" />
          <path
            fill="#000"
            stroke="#000"
            strokeWidth="5"
            d="M 86 46 L 91 80 q .8 6 6.8 6 h 24.4 q 6 0 6.8 -6 L 134 46 Z"
          />
          <path
            fill="#000"
            stroke="#000"
            strokeWidth="5"
            d={elipsa(110, 46, 24, 5)}
          />
          <path
            fill="none"
            stroke="#000"
            strokeWidth="8"
            d="M 134 55 q 14 -1 13 10 q -1 10 -13 9"
          />
        </mask>
      </defs>
      <g mask="url(#pi-snidane-talir)">
        <path {...T} d={elipsa(110, 90, 34, 7)} />
      </g>

      {/* Hrnek. Tělo je otevřená cesta — Z by přes ústí šálku dokreslilo
         příčku a ta vypadala jako čára uvnitř hrnku; obruč dělá elipsa. */}
      <path
        {...T}
        d="M 86 46 L 91 80 q .8 6 6.8 6 h 24.4 q 6 0 6.8 -6 L 134 46"
      />
      <path {...T} d={elipsa(110, 46, 24, 5)} />
      <path {...T} d="M 134 55 q 14 -1 13 10 q -1 10 -13 9" />
      <path {...T} className="pi-para" d="M 98 38 q 5 -6 0 -12 q -5 -6 0 -12" />
      <path
        {...T}
        className="pi-para pi-cek-1"
        d="M 110 34 q 5 -6 0 -12 q -5 -6 0 -12"
      />
      <path
        {...T}
        className="pi-para pi-cek-2"
        d="M 122 38 q 5 -6 0 -12 q -5 -6 0 -12"
      />
    </>
  ),

  /* Dva propletené snubní prstýnky v perspektivě, nad nimi tepe srdíčko.
     Každý kroužek je horní obruč, bok (výška prstenu) a dírka. */
  obrad: (
    <>
      <defs>
        {/* Kroužky jsou doopravdy provlečené — spodní obruč levého projde
           dírkou pravého. Aby to tak i vypadalo, musí se u jednoho křížení
           schovat levý a u druhého pravý. Řeší to dvě masky s VYPLNĚNOU
           siluetou celého prstenu i s bokem (ne jen obtaženou obručí) —
           kresba pak za druhým prstýnkem plynule zmizí, místo aby z ní byly
           vykousnuté kusy.

           Tah 6 kolem siluety I kolem dírky je tam kvůli mezeře: sám o sobě
           by ořez končil přesně na hraně tvaru a čáry obou prstýnků by se
           dotýkaly — vypadalo by to, že jeden do druhého vjíždí. Takhle mezi
           nimi zůstane asi 2 jednotky vzduchu (3 − polovina tahu 1,8).

           Okénko je spočítané z geometrie: levý prstýnek opouští pravý
           v bodech (98.8, 67.7) a (100.1, 79.1), dírku pravého v (109, 74.1).
           Kruh r=11 kolem (102, 73) je pokryje všechny a k hornímu křížení,
           kde má být navrchu pravý, nedosáhne (nejbližší je 22 daleko). */}
        <clipPath id="pi-obrad-okno">
          <circle cx="102" cy="73" r="11" />
        </clipPath>
        <mask
          id="pi-obrad-zadni"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="220"
          height="110"
        >
          <rect x="0" y="0" width="220" height="110" fill="#fff" />
          <g transform="translate(126 66) rotate(-12)">
            <path
              fill="#000"
              stroke="#000"
              strokeWidth="6"
              d={PRSTEN_SILUETA}
            />
            <path fill="#fff" stroke="none" d={elipsa(0, 0, 20, 10.7)} />
            <path
              fill="none"
              stroke="#000"
              strokeWidth="6"
              d={elipsa(0, 0, 20, 10.7)}
            />
          </g>
          {/* v okénku se role obrací — tam jde levý prstýnek navrch */}
          <circle cx="102" cy="73" r="11" fill="#fff" />
        </mask>
        <mask
          id="pi-obrad-predni"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="220"
          height="110"
        >
          <rect x="0" y="0" width="220" height="110" fill="#fff" />
          <g clipPath="url(#pi-obrad-okno)">
            <g transform="translate(88 56) rotate(-20)">
              <path
                fill="#000"
                stroke="#000"
                strokeWidth="6"
                d={PRSTEN_SILUETA}
              />
              <path fill="#fff" stroke="none" d={elipsa(0, 0, 20, 10.7)} />
              <path
                fill="none"
                stroke="#000"
                strokeWidth="6"
                d={elipsa(0, 0, 20, 10.7)}
              />
            </g>
          </g>
        </mask>
      </defs>

      {/* POZOR: mask a transform nesmí sedět na témže <g>. Maska se pak počítá
         v lokálních souřadnicích prstýnku (střed 0,0), ne ve viewBoxu, a
         obdélník 0 0 220 110 by z kroužku nechal jen jeden kvadrant.
         Proto maska na vnějším <g> a posun s otočením až na vnitřním. */}
      <g mask="url(#pi-obrad-zadni)">
        <g transform="translate(88 56) rotate(-20)">
          <path {...T} d={elipsa(0, 0, 28, 15)} />
          <path {...T} d="M -28 0 L -28 11 A 28 15 0 0 0 28 11 L 28 0" />
          <path {...T} d={elipsa(0, 0, 20, 10.7)} />
        </g>
      </g>

      <g mask="url(#pi-obrad-predni)">
        <g transform="translate(126 66) rotate(-12)">
          <path {...T} d={elipsa(0, 0, 28, 15)} />
          <path {...T} d="M -28 0 L -28 11 A 28 15 0 0 0 28 11 L 28 0" />
          <path {...T} d={elipsa(0, 0, 20, 10.7)} />
        </g>
      </g>

      {/* srdce nad středem dvojice — kroužky sahají od 56,6 do 158,8, střed 107,7 */}
      <g className="pi-tep">
        <path {...T} d={srdce(107, 11, 1.5)} />
      </g>
    </>
  ),

  /* fotoaparát s objektivem, z blesku nad ním vyšlehne záblesk */
  foceni: (
    <>
      <path
        {...T}
        d="M 70 46 h 76 q 6 0 6 6 v 36 q 0 6 -6 6 h -76 q -6 0 -6 -6 v -36 q 0 -6 6 -6 z"
      />
      <path {...T} d="M 86 46 l 5 -8 h 20 l 5 8" />
      <path {...T} d={kruh(106, 70, 16)} />
      <path {...T} d={kruh(106, 70, 7.5)} />
      <path {...T} d="M 130 46 v -6 h 14 v 6" />
      <g className="pi-blesk">
        <path {...T} d="M 137 34 v -10" />
        <path {...T} d="M 146 36 l 8 -7" />
        <path {...T} d="M 128 36 l -8 -7" />
        <path {...T} d="M 149 43 l 10 -3" />
        <path {...T} d="M 125 43 l -10 -3" />
      </g>
    </>
  ),

  /* dvě sklenky na stopce se ťuknou a mezi nimi cvrnkne jiskra */
  pripitek: (
    <>
      <g className="pi-cink-p">
        <path {...T} d="M 78 34 L 83 64 q 5 5 10 0 L 98 34 Z" />
        <path {...T} d="M 88 68 L 88 90" />
        <path {...T} d="M 77 91 q 11 5 22 0" />
        <Bublina cx={86} cy={52} r={1.9} />
        <Bublina cx={91} cy={58} r={1.5} cls="pi-cek-2" />
      </g>
      <g className="pi-cink-l">
        <path {...T} d="M 122 34 L 127 64 q 5 5 10 0 L 142 34 Z" />
        <path {...T} d="M 132 68 L 132 90" />
        <path {...T} d="M 121 91 q 11 5 22 0" />
        <Bublina cx={130} cy={52} r={1.9} cls="pi-cek-1" />
      </g>
      <g className="pi-jiskra">
        <path {...T} d="M 110 30 v -10" />
        <path {...T} d="M 118 33 l 7 -7" />
        <path {...T} d="M 102 33 l -7 -7" />
      </g>
    </>
  ),

  /* Patrový dort a nůž, který do něj zajíždí. Nůž není průhledný — čepel
     vykrajuje z dortu díru, takže za ní patra nejsou vidět. Díra se hýbe
     s nožem (stejná třída pi-nuz), proto má .pi-nuz v CSS transform-box:
     view-box a pevný střed otáčení; jinak by se maska a nůž točily každý
     kolem svého bboxu. V masce je <polygon>, ne <path>: na <path> visí
     dokreslovací dash a díra by se dokreslovala spolu s kresbou.

     translate srovnává kresbu na společnou osu x=110 (viz .pi-kresba).
     Střed otáčení nože zůstává 184,31 — transform-box: view-box se počítá
     ve vlastní soustavě prvku, tedy až za tímhle posunem. */
  dort: (
    <g transform="translate(-48 10)">
      <defs>
        <mask
          id="pi-dort-maska"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="220"
          height="110"
        >
          <rect x="0" y="0" width="220" height="110" fill="#fff" />
          <g className="pi-nuz">
            {/* Obrys celé čepele, ne jen proužek podél břicha — s proužkem
               dortem prosvítaly linky pater. Křivka ostří je navzorkovaná
               po čtvrtinách, protože <polygon> umí jen rovné hrany. Výplň
               plus tenký tah navíc pokryjí i sílu tahu samotné čepele. */}
            <polygon
              points="154,56 160.4,54.7 166,52.4 170.9,49.1 175,45 170,40"
              fill="#000"
              stroke="#000"
              strokeWidth="2.6"
              strokeLinejoin="round"
            />
          </g>
        </mask>
      </defs>
      <g mask="url(#pi-dort-maska)">
        <path {...T} d="M 134 84 h 44 v -14 h -44 z" />
        <path {...T} d="M 140 70 h 32 v -13 h -32 z" />
        <path {...T} d="M 146 57 h 20 v -12 h -20 z" />
        <path {...T} d="M 128 86 q 28 6 56 0" />
      </g>
      <path {...T} d={srdce(156, 30, 0.9)} />
      <g className="pi-nuz">
        {/* Kuchyňský nůž: rovný hřbet (úsečka, kterou uzavře Z), ostří s
         břichem a pata. Špička vychází ostrá díky miter — kulaté napojení
         by ji zaoblilo do oštěpu. */}
        <path
          {...T}
          strokeLinejoin="miter"
          strokeMiterlimit={14}
          d="M 154 56 C 163 55, 170 51, 175 45 L 170 40 Z"
        />
        {/* Rukojeť se zaobleným koncem. Její spodní hrana je totožná s patou
           čepele (170,40)–(175,45), takže na sebe nasedají; dřív tam byla
           mezera, která měla dělat objímku, ale v téhle velikosti vypadala
           jako přeražený nůž. */}
        <path
          {...T}
          d="M 170 40 L 178.5 31.5 C 180.8 29.2, 184.4 34.4, 182.8 37.2 L 175 45 Z"
        />
      </g>
    </g>
  ),

  /* taneční pár svedený do pár křivek;
     translate srovnává kresbu na společnou osu x=110 (viz .pi-kresba) */
  tanec: (
    <g transform="translate(32 0)">
      {/* Posun je na obalové skupině — na .pi-tanec ho dát nejde, tam by ho
         přepsala její vlastní CSS animace. */}
      {/* nevěsta v šatech a ženich v motýlku, drží se za ruce a kolébají se;
         oči jsou plné tečky (ne <path>), takže se nedokreslují — v klidu je
         schová opacity, viz .pi-oci v globals.css */}
      <g className="pi-tanec">
        {/* ženich */}
        <path {...T} d={kruh(88, 22, 11)} />
        <path {...T} d="M 80 14 c 3 -5 8 -6 11 -4" />
        <path {...T} d="M 87 11 c 4 -3 8 -2 10 1" />
        <path {...T} d="M 93 13 c 4 -2 6 0 7 3" />
        <path {...T} d="M 82 27 c 3 5 9 5 12 -1" />
        <path {...T} d="M 88 33 L 88 62" />
        <path {...T} d="M 88 36 L 80 32 L 80 40 Z" />
        <path {...T} d="M 88 36 L 96 32 L 96 40 Z" />
        {/* paže kolem jejího pasu — začíná níž než její zvednutá ruka,
         aby se obě čáry nepotkaly v jednom bodě */}
        <path {...T} d="M 88 55 C 79 56, 70 57, 62.5 58" />
        <path {...T} d={elipsa(58, 58, 4.5, 3.5)} />
        <path {...T} d="M 88 62 C 87 73, 87 82, 88 91" />
        <path {...T} d="M 88 62 C 95 70, 103 78, 110 85" />
        <path {...T} d={elipsa(91, 93.5, 6, 3)} />
        <g transform="rotate(28 113 87)">
          <path {...T} d={elipsa(113, 87, 6.5, 3)} />
        </g>

        {/* nevěsta — vlasy jsou jeden uzavřený obrys od pravého spánku přes
         temeno dolů do pramene a zpět k tváři, ať nikde nekončí ve vzduchu
         ani nezačínají uprostřed obličeje */}
        <path {...T} d={kruh(58, 30, 10)} />
        <path
          {...T}
          d="M 67 25 C 66 14, 49 11, 45 22 C 40 31, 36 44, 40 53 C 44 60, 52 57, 52 48 C 52 41, 49 36, 48.6 33.4"
        />
        <path {...T} d="M 58 34 c 2.5 2.5 4.5 1.8 5 -1.2" />
        <path {...T} d="M 51 46 C 56 42, 64 42, 69 46" />
        {/* šaty jsou prostý trojúhelník — rovné boky od ramen k rovnému lemu */}
        <path {...T} d="M 51 46 L 44 92" />
        <path {...T} d="M 44 92 L 76 92" />
        <path {...T} d="M 76 92 L 69 46" />
        <path {...T} d={elipsa(52, 94.6, 5, 2.6)} />
        <path {...T} d={elipsa(67, 94.6, 5, 2.6)} />

        {/* spojené ruce vpravo — její paže vede obloukem přes jeho hruď */}
        <path {...T} d="M 88 40 C 96 39, 103 39, 110 40" />
        <path {...T} d="M 69 47 C 82 53, 96 48, 109 42" />
        <path {...T} d="M 105 37 L 113 40 L 105 43" />

        {/* čárky pohybu — u vlasů, u nohou a za spojenýma rukama */}
        <g className="pi-svih">
          <path {...T} d="M 33 44 c -3 4 -3 8 0 12" />
          <path {...T} d="M 34 93 c -3 3 -3 6 0 8" />
          <path {...T} d="M 118 35 c 3 4 3 8 0 12" />
          <path {...T} d="M 123 33 c 4 5 4 11 0 16" />
        </g>

        <circle
          className="pi-oci"
          cx="84"
          cy="21"
          r="1.6"
          fill="currentColor"
          stroke="none"
        />
        <circle
          className="pi-oci"
          cx="92"
          cy="21"
          r="1.6"
          fill="currentColor"
          stroke="none"
        />
        <circle
          className="pi-oci"
          cx="54"
          cy="28"
          r="1.6"
          fill="currentColor"
          stroke="none"
        />
        <circle
          className="pi-oci"
          cx="62"
          cy="28"
          r="1.6"
          fill="currentColor"
          stroke="none"
        />
      </g>
    </g>
  ),

  /* sklenka s ledem a nad ní vpravo sluníčko s roztočenými paprsky */
  odpoledne: (
    <g transform="translate(9 0)">
      {/* Sklenka je nově vlevo (blíž textu), slunce vpravo a o 20 jednotek
         výš, aby spolu nestály v jedné řadě. Posuny jsou na obalových
         skupinách — na .pi-slunce nesmí být, tam by je přepsala rotace. */}
      <g transform="translate(-102 0)">
        <path
          {...T}
          d="M 134 44 L 138 84 q .5 4 4.5 4 h 20 q 4 0 4.5 -4 L 171 44 Z"
        />
        <path {...T} d={elipsa(152.5, 44, 18.5, 4)} />
        <path {...T} d="M 141 63 L 150 61 L 152 70 L 143 72 Z" />
        <path {...T} d="M 153 68 L 162 66 L 164 75 L 155 77 Z" />
        <Bublina cx={147} cy={79} r={1.5} />
        <Bublina cx={159} cy={81} r={1.2} cls="pi-cek-2" />
      </g>
      <g transform="translate(47 -32)">
        <path {...T} d={kruh(60, 52, 14)} />
        <g className="pi-slunce">
          <path {...T} d="M 60 32 v -8" />
          <path {...T} d="M 60 72 v 8" />
          <path {...T} d="M 40 52 h -8" />
          <path {...T} d="M 80 52 h 8" />
          <path {...T} d="M 74.1 38 L 79.8 32.3" />
          <path {...T} d="M 45.9 38 L 40.2 32.3" />
          <path {...T} d="M 74.1 66 L 79.8 71.7" />
          <path {...T} d="M 45.9 66 L 40.2 71.7" />
        </g>
      </g>
    </g>
  ),

  /* disko koule — poledníky se zužují a rozšiřují, takže se koule tváří, že se
     točí — a kolem ní padají konfety */
  party: (
    <g transform="translate(-5 10)">
      <path {...T} d="M 110 14 v 10" />
      <path {...T} d={kruh(110, 48, 24)} />
      <path {...T} d="M 88.2 38 h 43.6" />
      <path {...T} d="M 86 48 h 48" />
      <path {...T} d="M 88.2 58 h 43.6" />
      <g className="pi-koule-a">
        <path {...T} d={elipsa(110, 48, 16, 24)} />
      </g>
      <g className="pi-koule-b">
        <path {...T} d={elipsa(110, 48, 8, 24)} />
      </g>
      <path {...T} className="pi-trpyt" d="M 80 26 v -7 M 76.5 22.5 h 7" />
      <path
        {...T}
        className="pi-trpyt pi-cek-2"
        d="M 141 32 v -7 M 137.5 28.5 h 7"
      />
      <g className="pi-konfeta">
        <path {...T} d="M 64 32 l 7 -4" />
      </g>
      <g className="pi-konfeta pi-cek-2">
        <path {...T} d="M 76 22 l 6 4" />
      </g>
      <g className="pi-konfeta pi-cek-1">
        <path {...T} d="M 150 26 l 7 -4" />
      </g>
      <g className="pi-konfeta pi-cek-3">
        <path {...T} d="M 160 36 l 6 4" />
      </g>
    </g>
  ),
};

/* Vypnutí právě hrající ikony — CSS :hover je při scrollu nespolehlivý
   (prohlížeč ho bez pohybu myši nepřepočítá a ikony zůstávaly svítit přes
   sebe), takže aktivaci řídí JS a hraje vždy nejvýš jedna. */
let vypniAktivni: (() => void) | null = null;

export default function Ikona({ typ }: { typ: IkonaTyp }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hraje, setHraje] = useState(false);

  /* Přisazení ikony těsně k textu jejího bodu programu.

     Měřit se to musí až v prohlížeči, a to dvakrát:
     1) Kde doopravdy končí text. Nadpis i odstavec jsou bloky přes celých
        560 px, takže jejich getBoundingClientRect() je k ničemu — skutečnou
        šířku řádků dá až Range přes jejich obsah.
     2) Kde uvnitř SVG začíná kresba. Každá ikona kreslí jinak široko (od
        x=15 u tance po x=77 u přípitku), takže mezi textem a obrázkem
        zbýval pruh prázdna dlouhý až 70 px. Posun ji přitáhne k okraji.

     Body programu mají různě dlouhé řádky, takže se ikony nesrovnají pod
     sebe do jedné osy — jinak by u krátkých nadpisů („Večerní párty“)
     zůstalo mezi textem a obrázkem skoro 500 px prázdna. */
  useEffect(() => {
    const el = ref.current;
    const event = el?.closest<HTMLElement>(".event");
    const kresba = el?.querySelector<SVGGElement>(".pi-kresba");
    if (!el || !event || !kresba) return;

    const srovnej = () => {
      // v úzkém rozvržení sedí ikona nad textem a napevno se neposouvá
      if (getComputedStyle(el).position !== "absolute") {
        el.style.left = "";
        return;
      }
      // getBBox nepočítá vlastní transform elementu, takže je to idempotentní
      const bb = kresba.getBBox();
      if (bb.width)
        kresba.setAttribute(
          "transform",
          `translate(${(6 - bb.x).toFixed(1)} 0)`,
        );

      const eb = event.getBoundingClientRect();
      let konec = eb.left;
      for (const dite of Array.from(event.children)) {
        if (dite === el) continue;
        const r = document.createRange();
        r.selectNodeContents(dite);
        const b = r.getBoundingClientRect();
        if (b.width) konec = Math.max(konec, b.right);
      }
      el.style.left = `${Math.round(konec - eb.left + (MEZERA[typ] ?? 8))}px`;
    };

    srovnej();
    window.addEventListener("resize", srovnej);
    // po dopadu webfontu se řádky přelomí jinak, tak přeměříme
    document.fonts?.ready.then(srovnej).catch(() => {});
    return () => window.removeEventListener("resize", srovnej);
  }, []);

  useEffect(() => {
    const el = ref.current;
    const event = el?.closest(".event");
    if (!el || !event) return;

    let zapnuto = false;
    const vypni = () => {
      zapnuto = false;
      setHraje(false);
    };

    // dotyková zařízení: ikona je sbalená a rozbalí se až klepnutím na kartu
    // (další klepnutí, nebo klepnutí na jinou kartu, ji zase zavře)
    if (window.matchMedia("(hover: none)").matches) {
      const prepni = () => {
        if (zapnuto) {
          vypni();
          return;
        }
        if (vypniAktivni && vypniAktivni !== vypni) vypniAktivni();
        vypniAktivni = vypni;
        zapnuto = true;
        setHraje(true);
      };
      event.addEventListener("click", prepni);
      return () => {
        event.removeEventListener("click", prepni);
        if (vypniAktivni === vypni) vypniAktivni = null;
      };
    }

    // myš: aktivace na najetí do karty, exkluzivně
    let mysY = -1;
    const zapni = (e: MouseEvent) => {
      mysY = e.clientY;
      if (vypniAktivni && vypniAktivni !== vypni) vypniAktivni();
      vypniAktivni = vypni;
      setHraje(true);
    };
    const pohyb = (e: MouseEvent) => {
      mysY = e.clientY;
    };
    const opusti = () => {
      mysY = -1;
      vypni();
    };
    // při scrollu pod kurzorem mouseleave nepřijde — ohlídáme polohu ručně
    const scroll = () => {
      if (mysY < 0) return;
      const r = event.getBoundingClientRect();
      if (mysY < r.top || mysY > r.bottom) opusti();
    };
    event.addEventListener("mouseenter", zapni as EventListener);
    event.addEventListener("mousemove", pohyb as EventListener);
    event.addEventListener("mouseleave", opusti);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      event.removeEventListener("mouseenter", zapni as EventListener);
      event.removeEventListener("mousemove", pohyb as EventListener);
      event.removeEventListener("mouseleave", opusti);
      window.removeEventListener("scroll", scroll);
      if (vypniAktivni === vypni) vypniAktivni = null;
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`program-ikona${hraje ? " hraje" : ""}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 220 110">
        <g className="pi-kresba">{IKONY[typ]}</g>
      </svg>
    </div>
  );
}
