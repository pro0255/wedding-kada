"use client";

import { useEffect, useRef, useState } from "react";

/* Doodle panáčci k programu dne — čárová kresba ve stylu stick-figure rodinky.
   V klidu jsou neviditelní; na hover karty se sami „dokreslí" (stroke-draw přes
   stroke-dashoffset, proto má každá čára pathLength=1 a kreslí se jen <path>).
   Při přehrávání se čáry navíc chvějí „line boil" filtrem (feTurbulence +
   feDisplacementMap se skokovou změnou seedu — viz <ScenkyDefs />), takže kresba
   působí jako ručně kreslená animace. Pohyby jedou v CSS (globals.css, prefix
   sc-). Na dotykových zařízeních spouští scénku IntersectionObserver.

   POZOR: CSS transform animace přepíše atribut transform na témže elementu,
   proto animované skupiny nikdy nenesou polohovací translate — ten patří na
   vnější <g> a animační třída na vnitřní. */

export type ScenkaTyp =
  | "snidane"
  | "obrad"
  | "foceni"
  | "pripitek"
  | "tanec"
  | "odpoledne"
  | "party";

const T = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  pathLength: 1,
};

/* kružnice jako path — kvůli stroke-draw efektu (pathLength na <circle>
   neumí starší Safari/Chrome) */
const kruh = (cx: number, cy: number, r: number) =>
  `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;

const elipsa = (cx: number, cy: number, rx: number, ry: number) =>
  `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${2 * rx} 0 a ${rx} ${ry} 0 1 0 ${-2 * rx} 0`;

const srdce = (x: number, y: number, s = 1) =>
  `M ${x} ${y} c ${-1.5 * s} ${-4 * s} ${-8 * s} ${-4 * s} ${-8 * s} ${s} c 0 ${4 * s} ${5 * s} ${7 * s} ${8 * s} ${10 * s} c ${3 * s} ${-3 * s} ${8 * s} ${-6 * s} ${8 * s} ${-10 * s} c 0 ${-5 * s} ${-6.5 * s} ${-5 * s} ${-8 * s} ${-s} Z`;

/* skupina s pozicí: translate na vnějším <g>, animační třída na vnitřním */
function Poloz({
  x,
  y,
  cls,
  children,
}: {
  x: number;
  y: number;
  cls?: string;
  children: React.ReactNode;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {cls ? <g className={cls}>{children}</g> : children}
    </g>
  );
}

/* hlava s obličejem, střed v (0, cy); výplně (bělmo hlavy, oči) se objevují
   přes sc-vypln až po dokreslení čar */
function Hlava({ holka = false, cy = -55 }: { holka?: boolean; cy?: number }) {
  return (
    <>
      {holka && (
        <>
          <path d={`M -6 ${cy - 6} Q -11 ${cy} -9 ${cy + 8}`} {...T} />
          <path d={`M 6 ${cy - 6} Q 11 ${cy} 9 ${cy + 8}`} {...T} />
        </>
      )}
      <path className="sc-vypln" d={kruh(0, cy, 7)} {...T} fill="var(--bg)" />
      <circle className="sc-vypln" cx={-2.5} cy={cy - 1.5} r={0.9} fill="currentColor" stroke="none" />
      <circle className="sc-vypln" cx={2.5} cy={cy - 1.5} r={0.9} fill="currentColor" stroke="none" />
      <path d={`M -3 ${cy + 2} Q 0 ${cy + 5} 3 ${cy + 2}`} {...T} strokeWidth={1.5} />
    </>
  );
}

/* stojící panáček, nohy na y=0; paže se dají přepsat */
function Muz({
  armL = "M 0 -45 L -11 -34",
  armR = "M 0 -45 L 11 -34",
  deti,
}: {
  armL?: string | null;
  armR?: string | null;
  deti?: React.ReactNode;
}) {
  return (
    <>
      <path d="M 0 -48 L 0 -22" {...T} />
      <path d="M 0 -22 L -7 -2 Q -8 1 -11 0" {...T} />
      <path d="M 0 -22 L 7 -2 Q 8 1 11 0" {...T} />
      {armL && <path d={armL} {...T} />}
      {armR && <path d={armR} {...T} />}
      {deti}
      <Hlava />
    </>
  );
}

/* stojící panenka v šatech, nohy na y=0 */
function Zena({
  armL = "M -3 -44 L -13 -33",
  armR = "M 3 -44 L 13 -33",
  deti,
}: {
  armL?: string | null;
  armR?: string | null;
  deti?: React.ReactNode;
}) {
  return (
    <>
      <path d="M 0 -48 L -11 -20 L 11 -20 Z" {...T} />
      <path d="M -4 -20 L -6 -2 Q -7 1 -10 0" {...T} />
      <path d="M 4 -20 L 6 -2 Q 7 1 10 0" {...T} />
      {armL && <path d={armL} {...T} />}
      {armR && <path d={armR} {...T} />}
      {deti}
      <Hlava holka />
    </>
  );
}

/* sklenka na stopce, miska nahoře; (x,y) je spodek stopky */
function Sklenka({ x, y }: { x: number; y: number }) {
  return (
    <>
      <path d={`M ${x} ${y} L ${x} ${y - 6}`} {...T} strokeWidth={1.8} />
      <path d={`M ${x - 4} ${y - 12} L ${x} ${y - 6} L ${x + 4} ${y - 12}`} {...T} strokeWidth={1.8} />
    </>
  );
}

/* nota — hlavička s nožičkou a praporkem, (0,0) je hlavička */
function Nota() {
  return (
    <>
      <circle cx={0} cy={0} r={2.4} fill="currentColor" stroke="none" />
      <path d="M 2.2 0 L 2.2 -11 q 5 1 4 6" {...T} strokeWidth={1.6} />
    </>
  );
}

const SCENY: Record<ScenkaTyp, React.ReactNode> = {
  /* jeden pije kafe, jedna zvedá hrnek, třetí jí vidličkou z talířku;
     nad hrnky se vlní pára */
  snidane: (
    <>
      <path d="M 75 74 L 125 74" {...T} />
      <path d="M 81 74 L 78 100 M 119 74 L 122 100" {...T} />
      <path d={elipsa(100, 71, 9, 2.4)} {...T} strokeWidth={1.8} />
      <path d="M 96 68 q 4 -3 8 0" {...T} strokeWidth={1.5} />
      <Poloz x={40} y={100}>
        <Muz
          armL="M 0 -45 L -10 -33"
          armR={null}
          deti={
            <g className="sc-hrnek-p">
              <path d="M 0 -45 L 13 -38" {...T} />
              <path d="M 11 -43 h 8 v 7 h -8 z M 19 -42 q 4 1 0 4" {...T} strokeWidth={1.8} />
            </g>
          }
        />
      </Poloz>
      <Poloz x={150} y={100}>
        <Zena
          armR="M 3 -44 L 13 -33"
          armL={null}
          deti={
            <g className="sc-hrnek-l">
              <path d="M -3 -44 L -14 -38" {...T} />
              <path d="M -20 -43 h 8 v 7 h -8 z M -20 -42 q -4 1 0 4" {...T} strokeWidth={1.8} />
            </g>
          }
        />
      </Poloz>
      <Poloz x={195} y={100}>
        <Zena
          armL="M -3 -44 L -13 -37"
          armR={null}
          deti={
            <>
              <path d={elipsa(-16, -37, 6, 1.8)} {...T} strokeWidth={1.5} />
              <g className="sc-vidlicka">
                <path d="M 3 -44 L 14 -38" {...T} />
                <path d="M 14 -38 L 17 -46 M 15.5 -45.5 l -1.5 -3 M 18 -46.5 l 0.5 -3.3" {...T} strokeWidth={1.6} />
              </g>
            </>
          }
        />
      </Poloz>
      <path className="sc-para" d="M 52 52 q 3 -4 0 -8 q -3 -4 0 -8" {...T} strokeWidth={1.6} />
      <path className="sc-para sc-zpozdeni-2" d="M 136 52 q -3 -4 0 -8 q 3 -4 0 -8" {...T} strokeWidth={1.6} />
      <path className="sc-para sc-zpozdeni-1" d="M 100 62 q 3 -3 0 -7 q -3 -3 0 -7" {...T} strokeWidth={1.6} />
      {/* mrně Maxík — běhá v popředí tam a zpátky kolem rodičů */}
      <Poloz x={25} y={106}>
        <g className="sc-maxik-beh">
          <g className="sc-maxik-smer">
            <g className="sc-maxik-hop">
              <path className="sc-vypln" d={kruh(0, -26, 4.5)} {...T} strokeWidth={1.8} fill="var(--bg)" />
              <circle className="sc-vypln" cx={-1.6} cy={-27} r={0.7} fill="currentColor" stroke="none" />
              <circle className="sc-vypln" cx={1.6} cy={-27} r={0.7} fill="currentColor" stroke="none" />
              <path d="M -1.8 -24.5 Q 0 -23 1.8 -24.5" {...T} strokeWidth={1.2} />
              <path d="M 0 -21.5 L 0 -10" {...T} strokeWidth={1.8} />
              <path d="M 0 -18 L 6 -21" {...T} strokeWidth={1.8} />
              <path d="M 0 -17 L -5.5 -13" {...T} strokeWidth={1.8} />
              <path className="sc-nozka-a" d="M 0 -10 L -5 0 q -1 2 -3 1" {...T} strokeWidth={1.8} />
              <path className="sc-nozka-b" d="M 0 -10 L 5 0 q 1 2 3 1" {...T} strokeWidth={1.8} />
            </g>
          </g>
        </g>
      </Poloz>
    </>
  ),

  /* zvonička zvoní, ženich a nevěsta se naklání k puse, srdce vyskočí
     a malá srdíčka stoupají, po stranách potlesk */
  obrad: (
    <>
      <g className="sc-zvon">
        <path d="M 34 24 q 7 -15 14 0 q 3 4 -2 4 l -10 0 q -5 0 -2 -4" {...T} strokeWidth={1.9} />
        <circle className="sc-vypln" cx={41} cy={31} r={1.7} fill="currentColor" stroke="none" />
      </g>
      <path className="sc-cinky" d="M 24 16 q -4 4 -3 8 M 58 16 q 4 4 3 8" {...T} strokeWidth={1.5} />
      <Poloz x={92} y={100} cls="sc-nakloni-p">
        <Muz armL="M 0 -45 L -9 -33" armR="M 0 -45 L 11 -40" />
      </Poloz>
      <Poloz x={128} y={100} cls="sc-nakloni-l">
        <Zena armR="M 3 -44 L 12 -33" armL="M -3 -44 L -12 -41" />
      </Poloz>
      <path className="sc-srdce" d={srdce(110, 30)} fill="var(--palette-rose)" stroke="none" />
      <path className="sc-srdicko sc-zpozdeni-1" d={srdce(88, 48, 0.55)} fill="var(--palette-rose)" stroke="none" />
      <path className="sc-srdicko sc-zpozdeni-3" d={srdce(133, 44, 0.45)} fill="var(--palette-rose)" stroke="none" />
      <Poloz x={30} y={100}>
        <Muz
          armL={null}
          armR={null}
          deti={
            <>
              <path className="sc-tlesk-a" d="M 0 -45 L -9 -56" {...T} />
              <path className="sc-tlesk-b" d="M 0 -45 L 9 -56" {...T} />
            </>
          }
        />
      </Poloz>
      <Poloz x={190} y={100}>
        <Zena
          armL={null}
          armR={null}
          deti={
            <>
              <path className="sc-tlesk-a" d="M 0 -45 L -9 -56" {...T} />
              <path className="sc-tlesk-b" d="M 0 -45 L 9 -56" {...T} />
            </>
          }
        />
      </Poloz>
    </>
  ),

  /* fotograf blýskne a z foťáku vypadne momentka; skupinka pózuje,
     poskakuje a mává */
  foceni: (
    <>
      <Poloz x={31} y={100}>
        <Muz
          armL="M 0 -45 L 11 -49"
          armR="M 0 -45 L 11 -44"
          deti={
            <>
              <path d="M 10 -54 h 13 v 9 h -13 z" {...T} strokeWidth={1.8} />
              <path d={kruh(16.5, -49.5, 2)} {...T} strokeWidth={1.5} />
            </>
          }
        />
      </Poloz>
      <g className="sc-blesk">
        <path d="M 64 42 l 0 -7 M 64 42 l 6 -4 M 64 42 l -6 -4 M 64 42 l 5 4 M 64 42 l -5 4" {...T} strokeWidth={1.6} />
      </g>
      <Poloz x={46} y={60} cls="sc-polaroid">
        <path d="M 0 0 h 17 v 15 h -17 z" {...T} strokeWidth={1.6} />
        <path d="M 2.5 2.5 h 12 v 8 h -12 z" {...T} strokeWidth={1.3} />
        <circle cx={6} cy={7} r={1.2} fill="currentColor" stroke="none" />
        <circle cx={11} cy={7} r={1.2} fill="currentColor" stroke="none" />
      </Poloz>
      <Poloz x={116} y={100} cls="sc-hop">
        <Zena />
      </Poloz>
      <Poloz x={144} y={100} cls="sc-hop sc-zpozdeni-1">
        <Muz
          armL="M 0 -45 L -11 -34"
          armR={null}
          deti={<path className="sc-mava" d="M 0 -45 L 10 -57" {...T} />}
        />
      </Poloz>
      <Poloz x={172} y={100} cls="sc-hop sc-zpozdeni-2">
        <Zena />
      </Poloz>
    </>
  ),

  /* ťuknutí sklenkami, jiskra a stoupající bublinky */
  pripitek: (
    <>
      <Poloz x={31} y={100}>
        <Muz
          armL="M 0 -45 L -10 -33"
          armR={null}
          deti={
            <g className="sc-cink-p">
              <path d="M 0 -45 L 13 -55" {...T} />
              <Sklenka x={15} y={-56} />
            </g>
          }
        />
      </Poloz>
      <Poloz x={81} y={100}>
        <Zena
          armR="M 3 -44 L 13 -33"
          armL={null}
          deti={
            <g className="sc-cink-l">
              <path d="M -3 -44 L -15 -55" {...T} />
              <Sklenka x={-17} y={-56} />
            </g>
          }
        />
      </Poloz>
      <g className="sc-jiskra">
        <path d="M 56 36 l 0 -6 M 56 36 l 5 -3 M 56 36 l -5 -3 M 56 36 l 4 4 M 56 36 l -4 4" {...T} strokeWidth={1.6} />
      </g>
      {[
        [50, 40, 1],
        [58, 44, 2],
        [63, 38, 3],
        [53, 34, 4],
      ].map(([x, y, z]) => (
        <circle key={z} className={`sc-bublina sc-zpozdeni-${z}`} cx={x} cy={y} r={1.4} fill="currentColor" stroke="none" />
      ))}
    </>
  ),

  /* pár se kolébá v tanci mezi notami, vedle dort s plápolající svíčkou */
  tanec: (
    <>
      <Poloz x={42} y={100} cls="sc-tanec">
        <g transform="translate(-13 0)">
          <Muz armL="M 0 -45 L -11 -34" armR="M 0 -45 L 13 -41" />
        </g>
        <g transform="translate(13 0)">
          <Zena armL="M -3 -44 L -13 -41" armR="M 3 -44 L 13 -33" />
        </g>
      </Poloz>
      <Poloz x={10} y={48} cls="sc-nota">
        <Nota />
      </Poloz>
      <Poloz x={100} y={38} cls="sc-nota sc-zpozdeni-2">
        <Nota />
      </Poloz>
      <path d="M 115 86 h 40 v 14 h -40 z" {...T} />
      <path d="M 122 74 h 26 v 12 h -26 z" {...T} />
      <path d="M 129 64 h 12 v 10 h -12 z" {...T} />
      <path d="M 135 64 L 135 57" {...T} strokeWidth={1.8} />
      <path
        className="sc-plamen sc-vypln"
        d="M 135 57 q 3.5 -4 0 -8 q -3.5 4 0 8"
        fill="var(--palette-yellow)"
        stroke="currentColor"
        strokeWidth={1.4}
        pathLength={1}
      />
    </>
  ),

  /* pohoda: sluníčko se točí, přes scénu létá motýl, panáček sedí
     a houpe sklenkou, panenka se kolébá */
  odpoledne: (
    <>
      <path d={kruh(30, 30, 7)} {...T} />
      <g className="sc-slunce">
        <path
          d="M 30 18 v -5 M 30 42 v 5 M 18 30 h -5 M 42 30 h 5 M 21.5 21.5 l -3.5 -3.5 M 38.5 38.5 l 3.5 3.5 M 21.5 38.5 l -3.5 3.5 M 38.5 21.5 l 3.5 -3.5"
          {...T}
          strokeWidth={1.8}
        />
      </g>
      <Poloz x={56} y={40} cls="sc-motyl-x">
        <g className="sc-motyl-y">
          <path d="M 0 -2 L 0 4" {...T} strokeWidth={1.6} />
          <path className="sc-kridlo-a" d="M -1 0 q -7 -7 -10 -1 q -2 5 10 3" {...T} strokeWidth={1.5} />
          <path className="sc-kridlo-b" d="M 1 0 q 7 -7 10 -1 q 2 5 -10 3" {...T} strokeWidth={1.5} />
        </g>
      </Poloz>
      <Poloz x={81} y={100}>
        {/* sedící panáček opřený dozadu */}
        <path d="M 0 -4 L 16 -4 Q 20 -4 20 -8" {...T} />
        <path d="M 0 -4 L -8 -30" {...T} />
        <path d="M -7 -26 L -17 -3" {...T} />
        <g className="sc-houpe">
          <path d="M -7 -26 L 7 -20" {...T} />
          <path d="M 7 -20 L 7 -25 M 3 -31 L 7 -25 L 11 -31" {...T} strokeWidth={1.8} />
        </g>
        <g transform="translate(-10 18)">
          <Hlava cy={-55} />
        </g>
      </Poloz>
      <Poloz x={170} y={100} cls="sc-koleba">
        <Zena />
      </Poloz>
    </>
  ),

  /* disko koule se houpe a třpytí, panáčci hopsají (squash & stretch),
     kolem létají noty */
  party: (
    <>
      <path d="M 76 2 v 6" {...T} strokeWidth={1.6} />
      <g className="sc-koule">
        <path d={kruh(76, 15, 7)} {...T} strokeWidth={1.8} />
        <path d="M 69.5 13 h 13 M 69.5 17 h 13 M 74 8.5 v 13 M 78 8.5 v 13" {...T} strokeWidth={1.2} />
      </g>
      <path className="sc-trpyt" d="M 62 10 l -4 -2 M 90 10 l 4 -2" {...T} strokeWidth={1.5} />
      <path className="sc-trpyt sc-zpozdeni-2" d="M 63 22 l -4 3 M 89 22 l 4 3" {...T} strokeWidth={1.5} />
      {[21, 76, 131].map((x, i) => (
        <Poloz key={x} x={x} y={100} cls={`sc-skok sc-zpozdeni-${i}`}>
          {i === 1 ? (
            <Zena armL="M -3 -44 L -12 -57" armR="M 3 -44 L 12 -57" />
          ) : (
            <Muz armL="M 0 -45 L -10 -58" armR="M 0 -45 L 10 -58" />
          )}
        </Poloz>
      ))}
      {[
        [10, 50, 1],
        [48, 36, 3],
        [152, 44, 2],
      ].map(([x, y, z]) => (
        <Poloz key={z} x={x} y={y} cls={`sc-nota sc-zpozdeni-${z}`}>
          <Nota />
        </Poloz>
      ))}
    </>
  ),
};

/* Sdílený „line boil" filtr — chvění čar jako u ručně kreslené animace.
   Renderuje se jednou na stránce; scénky ho berou přes CSS filter: url(#sc-boil).
   Seed skáče diskrétně (klasický boil „na trojky"), plynulá změna by vypadala
   jako tekutina, ne jako překreslované okénka. */
export function ScenkyDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="sc-boil" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="2" seed="1" result="sum">
            <animate attributeName="seed" values="1;4;7;10;13;16" dur="0.9s" repeatCount="indefinite" calcMode="discrete" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="sum" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

/* Vypnutí právě hrající scénky — CSS :hover je při scrollu nespolehlivý
   (prohlížeč ho bez pohybu myši nepřepočítá a scénky zůstávaly svítit přes
   sebe), takže aktivaci řídí JS a hraje vždy nejvýš jedna. */
let vypniAktivni: (() => void) | null = null;

export default function Scenka({ typ }: { typ: ScenkaTyp }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hraje, setHraje] = useState(false);

  useEffect(() => {
    const el = ref.current;
    const event = el?.closest(".event");
    if (!el || !event) return;

    const vypni = () => setHraje(false);

    // dotyková zařízení: scénka se dokreslí, když je karta ve viewportu
    if (window.matchMedia("(hover: none)").matches) {
      const io = new IntersectionObserver(([e]) => setHraje(e.isIntersecting), { threshold: 0.5 });
      io.observe(el);
      return () => io.disconnect();
    }

    // usadit scénku hned vedle textu: karta je široká 560px, ale texty končí
    // dřív — spočítáme nejdelší řádek (nadpis, čas i odstavec) a scénku
    // přisadíme těsně za něj
    const umisti = () => {
      const er = event.getBoundingClientRect();
      let max = 0;
      event.querySelectorAll(":scope > h3, :scope > .meta, :scope > p").forEach((ch) => {
        const range = document.createRange();
        range.selectNodeContents(ch);
        const r = range.getBoundingClientRect();
        max = Math.max(max, r.right - er.left);
      });
      if (max <= 0) return;
      // vycentruj kresbu do volného prostoru mezi koncem textu a pravým
      // okrajem karty; náběh = prázdné místo uvnitř SVG před první čárou
      const svg = el.querySelector("svg");
      const kresba = svg?.querySelector(".sc-kresba") as SVGGraphicsElement | null;
      if (!svg || !kresba) return;
      const scale = svg.getBoundingClientRect().width / 220;
      const bb = kresba.getBBox();
      const nabeh = bb.x * scale;
      const sirkaKresby = bb.width * scale;
      const volno = er.width - max;
      const odsazeni = Math.max(12, (volno - sirkaKresby) / 2);
      el.style.left = `${Math.round(max + odsazeni - nabeh)}px`;
    };
    umisti();
    document.fonts?.ready.then(umisti);
    window.addEventListener("resize", umisti);

    // myš: aktivace na najetí do karty, exkluzivně
    let mysY = -1;
    const zapni = (e: MouseEvent) => {
      mysY = e.clientY;
      if (vypniAktivni && vypniAktivni !== vypni) vypniAktivni();
      vypniAktivni = vypni;
      setHraje(true);
    };
    const pohyb = (e: MouseEvent) => { mysY = e.clientY; };
    const opusti = () => { mysY = -1; vypni(); };
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
      window.removeEventListener("resize", umisti);
      if (vypniAktivni === vypni) vypniAktivni = null;
    };
  }, []);

  return (
    <div ref={ref} className={`scenka${hraje ? " hraje" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 220 110">
        <g className="sc-kresba">{SCENY[typ]}</g>
      </svg>
    </div>
  );
}
