"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { Lic, StranaDeti, StranaDospeli } from "./obsah";
import s from "./kniha.module.css";

/* Svatební menu jako kniha s opravdovou tloušťkou.

   Desky jsou kvádr: líc nahoře, rub (s menu pro dospělé) dole a tři boční
   hrany natočené o 90°. Pod deskami leží blok listů, jehož ořízka je vidět
   zprava a zdola. Celá kniha leží na stole mírně nakloněná od diváka, aby
   tloušťka byla vůbec vidět; při otevření se „kamera“ narovná, ať se text čte
   rovně.

   Otevření má tři doby, jako u těžké knihy v ruce:
   1. nadzvednutí — deska se odlepí od bloku (translateZ) a pootočí o pár stupňů,
   2. přetočení přes hřbet — s odleskem, který přejede po líci,
   3. dosednutí — přetočí se o 4° dál a usadí se zpátky (překmit).
   K tomu vržený stín na pravé straně, který s odklápěním ucuká ke hřbetu,
   a rub, který se rozsvítí, až dopadne na světlo.

   Klidové stavy (zavřeno/otevřeno) drží CSS. Web Animations API kreslí jen
   přechod mezi nimi a po doběhnutí se zruší. Když se klikne v půlce, běžící
   animace se jen otočí (reverse) — kniha se plynule vrátí, nic neskočí. */

const TELEFON = "(max-width: 720px)";
const KLID = "(prefers-reduced-motion: reduce)";
const DELKA = 1750;

export default function Kniha() {
  const [otevrene, setOtevrene] = useState(false);
  const [strana, setStrana] = useState(0);
  const animace = useRef<Animation[]>([]);
  const kniha = useRef<HTMLDivElement>(null);
  const obalka = useRef<HTMLDivElement>(null);
  const lesk = useRef<HTMLSpanElement>(null);
  const tmaLic = useRef<HTMLSpanElement>(null);
  const tmaRub = useRef<HTMLDivElement>(null);
  const vrzeny = useRef<HTMLDivElement>(null);
  const stul = useRef<HTMLDivElement>(null);
  const slajdy = useRef<HTMLDivElement>(null);
  // Cílový stav zvlášť od Reactu: překreslení běží v přechodu (startTransition),
  // takže dvě rychlá klepnutí po sobě musí vědět, kam se zrovna jede.
  const cil = useRef(false);

  function prepni() {
    const nove = !cil.current;
    cil.current = nove;
    // Animace se spustí hned (Web Animations níž), React přepne třídy
    // v přechodu — po kouskách, takže první snímky nic nezdrží.
    startTransition(() => setOtevrene(nove));

    const bezi = animace.current.filter((a) => a.playState === "running");
    if (bezi.length) {
      bezi.forEach((a) => a.reverse());
      return;
    }
    if (matchMedia(KLID).matches) return;
    const seznam = vytvorAnimace(nove);
    animace.current = seznam;
    Promise.all(seznam.map((a) => a.finished))
      .then(() => seznam.forEach((a) => a.cancel()))
      .catch(() => {});
  }

  function vytvorAnimace(nove: boolean): Animation[] {
    if (!kniha.current || !obalka.current) return [];
    const tel = matchMedia(TELEFON).matches;
    const z = {
      duration: DELKA,
      direction: nove ? ("normal" as const) : ("reverse" as const),
      fill: "both" as const,
    };
    const posun = tel ? "0%" : "-25%";
    const naklonZ = tel ? 12 : 16;
    const naklonO = tel ? 3 : 5;

    const seznam: Animation[] = [
      kniha.current.animate(
        [
          { transform: `rotateX(${naklonZ}deg) translateX(${posun})`, easing: "cubic-bezier(.55,0,.25,1)" },
          { transform: `rotateX(${naklonZ}deg) translateX(${posun})`, offset: 0.1, easing: "cubic-bezier(.45,0,.2,1)" },
          { transform: `rotateX(${naklonO}deg) translateX(0%)` },
        ],
        z,
      ),
      obalka.current.animate(
        [
          { transform: "translateZ(0px) rotateY(0deg)", easing: "cubic-bezier(.3,0,.4,1)" },
          { transform: "translateZ(16px) rotateY(-10deg)", offset: 0.17, easing: "cubic-bezier(.42,.02,.32,1)" },
          { transform: "translateZ(7px) rotateY(-184deg)", offset: 0.8, easing: "cubic-bezier(.3,0,.25,1)" },
          { transform: "translateZ(0px) rotateY(-180deg)" },
        ],
        z,
      ),
    ];
    if (lesk.current)
      seznam.push(
        lesk.current.animate(
          [
            { transform: "translateX(100%)", opacity: 0 },
            { transform: "translateX(55%)", opacity: 1, offset: 0.15 },
            { transform: "translateX(-90%)", opacity: 0.4, offset: 0.48 },
            { transform: "translateX(-90%)", opacity: 0 },
          ],
          z,
        ),
      );
    if (tmaLic.current)
      seznam.push(
        tmaLic.current.animate(
          [{ opacity: 0 }, { opacity: 0, offset: 0.2 }, { opacity: 0.5, offset: 0.5 }, { opacity: 0.5 }],
          z,
        ),
      );
    if (tmaRub.current)
      seznam.push(
        tmaRub.current.animate(
          [{ opacity: 0.55 }, { opacity: 0.55, offset: 0.5 }, { opacity: 0.12, offset: 0.82 }, { opacity: 0 }],
          z,
        ),
      );
    if (vrzeny.current)
      seznam.push(
        vrzeny.current.animate(
          [
            { opacity: 1, transform: "scaleX(1)" },
            { opacity: 1, transform: "scaleX(.85)", offset: 0.17 },
            { opacity: 0, transform: "scaleX(.05)", offset: 0.6 },
            { opacity: 0, transform: "scaleX(.05)" },
          ],
          z,
        ),
      );
    if (stul.current)
      seznam.push(stul.current.animate([{ opacity: 0 }, { opacity: 0, offset: 0.55 }, { opacity: 1 }], z));
    return seznam;
  }

  /* Nanečisto po načtení: animace se jednou založí a hned zruší (ve stejné
     úloze, takže se nic nevykreslí). Prohlížeč si přitom rozparsuje snímky
     a připraví vrstvy — první skutečné otevření pak nic takového nedělá. */
  useEffect(() => {
    const id = setTimeout(() => {
      for (const a of vytvorAnimace(true)) {
        a.pause();
        a.cancel();
      }
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function naStranu(i: number) {
    const el = slajdy.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: matchMedia(KLID).matches ? "auto" : "smooth" });
  }

  /* Listování klepnutím — vedle swipu. Strany jsou dvě, takže klepnutí prostě
     přehodí na tu druhou a za poslední se vrací na první: dá se listovat
     dokola jedním prstem.

     Tažení myší po stranách končí taky kliknutím, a to by stranu přehodilo
     hned po tom, co ji někdo přitáhl. Proto se měří, o kolik se ukazatel mezi
     stiskem a puštěním posunul — nad 10 px už to není klepnutí. */
  const stisk = useRef(0);

  function klepnutiNaStranu() {
    const el = slajdy.current;
    if (!el || !el.clientWidth) return;
    const ted = Math.round(el.scrollLeft / el.clientWidth);
    naStranu((ted + 1) % el.children.length);
  }

  return (
    <div className={s.obal}>
      <div className={s.perspektiva}>
        <div ref={kniha} className={s.kniha + (otevrene ? " " + s.otevrene : "")}>
          <div ref={stul} className={s.stinLevy} aria-hidden="true" />

          {/* Zadní deska s blokem listů. */}
          <div className={s.zadni}>
            <div className={s.zadniDeska} aria-hidden="true" />
            <div className={s.hranaBlokuPrava} aria-hidden="true" />
            <div className={s.hranaBlokuDolni} aria-hidden="true" />
            <div className={s.blok} id="svatebni-menu-obsah" inert={!otevrene}>
              <div className={s.jenDesktop}>
                <StranaDeti />
              </div>
              <div className={s.jenTelefon}>
                <div
                  ref={slajdy}
                  className={s.slajdy}
                  onPointerDown={(e) => { stisk.current = e.clientX; }}
                  onClick={(e) => {
                    if (Math.abs(e.clientX - stisk.current) < 10) klepnutiNaStranu();
                  }}
                  onScroll={(e) => {
                    const el = e.currentTarget;
                    setStrana(Math.round(el.scrollLeft / el.clientWidth));
                  }}
                >
                  <div className={s.slajd} role="group" aria-label="Strana 1 ze 2: menu">
                    <StranaDospeli />
                  </div>
                  <div className={s.slajd} role="group" aria-label="Strana 2 ze 2: pro děti">
                    <StranaDeti />
                  </div>
                </div>
              </div>
              <div className={s.hrbet} aria-hidden="true" />
              <div ref={vrzeny} className={s.vrzenyStin} aria-hidden="true" />
            </div>
          </div>

          {/* Přední deska — kvádr, který se otáčí přes hřbet. */}
          <div ref={obalka} className={s.obalka}>
            <button
              type="button"
              className={s.lic}
              onClick={prepni}
              aria-expanded={otevrene}
              aria-controls="svatebni-menu-obsah"
              aria-label="Otevřít svatební menu"
              tabIndex={otevrene ? -1 : 0}
            >
              <Lic />
              <span ref={lesk} className={s.lesk} aria-hidden="true" />
              <span ref={tmaLic} className={s.tmaLic} aria-hidden="true" />
            </button>
            <div className={s.hranaPrava} aria-hidden="true" />
            <div className={s.hranaHorni} aria-hidden="true" />
            <div className={s.hranaDolni} aria-hidden="true" />
            <div className={s.rub} inert={!otevrene}>
              <div className={s.jenDesktop}>
                <StranaDospeli />
              </div>
              <div className={s.predsadka} aria-hidden="true" />
              <div className={s.hrbetRub} aria-hidden="true" />
              <div ref={tmaRub} className={s.tmaRub} aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      <div className={s.ovladani}>
        {otevrene && (
          <div className={s.prepinac + " " + s.jenTelefonBlok} role="group" aria-label="Strana menu">
            <button type="button" aria-pressed={strana === 0} onClick={() => naStranu(0)}>Menu</button>
            <button type="button" aria-pressed={strana === 1} onClick={() => naStranu(1)}>Pro děti</button>
          </div>
        )}
        <button
          type="button"
          className={s.tlacitko}
          onClick={prepni}
          aria-expanded={otevrene}
          aria-controls="svatebni-menu-obsah"
        >
          {otevrene ? "Zavřít menu" : "Otevřít menu"}
        </button>
      </div>
    </div>
  );
}
