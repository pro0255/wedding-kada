"use client";

import { MotionConfig, motion, type TargetAndTransition, type Transition } from "motion/react";
import { startTransition, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { StranaDeti, StranaDospeli } from "../obsah";
import s from "./kapsa.module.css";

/* Návrh 3 — menu zasunuté v papírové kapse.

   Zavřené: dvě karty (menu a dětské menu) vykukují horním okrajem z kapsy
   s výřezem na palec. Po klepnutí se karty vytáhnou nahoru, kapsa mezitím
   klesne a zmizí, a karty se rozloží vedle sebe — každá lehce natočená,
   jako když je někdo položí na stůl. Dosednou s malým překmitem.

   Na telefonu leží karty na sobě (dětská vykukuje zpoza) a přepínají se
   tlačítky nebo klepnutím na zadní kartu: zadní se vysune doprava, v půlce
   cesty se přesune navrch a zajede zpátky.

   Animuje knihovna motion (už v projektu) — jen transform a opacity, takže
   to jede na kompozitoru. MotionConfig reducedMotion="user" při omezení
   pohybu pohyby přeskočí a nechá jen prolínání. */

const TELEFON = "(max-width: 720px)";
function useTelefon() {
  return useSyncExternalStore(
    (zmena) => {
      const mq = matchMedia(TELEFON);
      mq.addEventListener("change", zmena);
      return () => mq.removeEventListener("change", zmena);
    },
    () => matchMedia(TELEFON).matches,
    () => false,
  );
}

const DOSEDNUTI: [number, number, number, number] = [0.3, 1.22, 0.4, 1];
const VYTAZENI: [number, number, number, number] = [0.3, 0, 0.2, 1];

export default function Kapsa() {
  const [otevrene, setOtevrene] = useState(false);
  const [predni, setPredni] = useState(0); // telefon: která karta je navrch
  const [vrch, setVrch] = useState(0); // z-index se přepne až v půlce zamíchání
  const [michani, setMichani] = useState(0);
  const telefon = useTelefon();
  const casovac = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(casovac.current), []);

  function prepni() {
    startTransition(() => {
      setOtevrene((o) => !o);
      setMichani(0);
      setPredni(0);
      setVrch(0);
    });
  }

  function naKartu(i: number) {
    if (i === predni) return;
    startTransition(() => {
      setPredni(i);
      setMichani((m) => m + 1);
    });
    clearTimeout(casovac.current);
    casovac.current = setTimeout(() => setVrch(i), 280);
  }

  function cil(i: number): { animate: TargetAndTransition; transition: Transition } {
    const zpozdeni = i * 0.08;
    if (!otevrene) {
      return {
        animate: {
          y: [null, "-50%", "0%"],
          x: [null, "0%", i ? "3%" : "0%"],
          rotate: [null, 0, i ? 2.5 : 0],
          scale: [null, 1.02, 1],
        },
        transition: { duration: 1.2, times: [0, 0.4, 1], ease: [VYTAZENI, [0.45, 0, 0.25, 1]], delay: zpozdeni },
      };
    }
    if (telefon) {
      const naVrchu = predni === i;
      return {
        animate: {
          y: [null, "-50%", naVrchu ? "0%" : "1.5%"],
          x: [null, "0%", naVrchu ? "0%" : "4%"],
          rotate: [null, i ? 3 : -2, naVrchu ? 0 : 3.5],
          scale: [null, 1.02, naVrchu ? 1 : 0.97],
        },
        transition: { duration: 1.5, times: [0, 0.42, 1], ease: [VYTAZENI, DOSEDNUTI], delay: zpozdeni },
      };
    }
    return {
      animate: {
        y: [null, "-50%", "0%"],
        x: [null, "0%", i ? "53%" : "-53%"],
        rotate: [null, i ? 3 : -2, i ? 1.6 : -1.8],
        scale: [null, 1.03, 1],
      },
      transition: { duration: 1.6, times: [0, 0.4, 1], ease: [VYTAZENI, DOSEDNUTI], delay: zpozdeni },
    };
  }

  /* Zamíchání na telefonu: karta, která jde navrch, vyjede doprava a vrátí se. */
  function zamichani(i: number) {
    const naVrchu = predni === i;
    return {
      animate: naVrchu
        ? { x: [null, "70%", "0%"], rotate: [null, 9, 0], scale: [null, 1, 1], y: [null, "0%", "0%"] }
        : { x: [null, "-6%", "4%"], rotate: [null, -2, 3.5], scale: [null, 0.97, 0.97], y: [null, "1.5%", "1.5%"] },
      transition: { duration: 0.6, times: [0, 0.45, 1], ease: [[0.3, 0, 0.3, 1], DOSEDNUTI] } as Transition,
    };
  }

  const kapsa = otevrene
    ? {
        animate: { y: "55%", opacity: 0 },
        transition: {
          y: { duration: 0.95, ease: [0.5, 0, 0.6, 1] },
          opacity: { duration: 0.5, delay: 0.4 },
        } as Transition,
      }
    : {
        animate: { y: "0%", opacity: 1 },
        transition: {
          y: { duration: 0.8, ease: [0.2, 0, 0.2, 1], delay: 0.25 },
          opacity: { duration: 0.35, delay: 0.2 },
        } as Transition,
      };

  return (
    <MotionConfig reducedMotion="user">
      <div className={s.obal}>
        <div className={s.stul + (otevrene ? " " + s.otevrene : "")}>
          {/* Zadní díl kapsy — za kartami. */}
          <motion.div className={s.kapsaZadni} aria-hidden="true" initial={false} {...kapsa} />

          <div id="menu-v3-obsah" className={s.karty} inert={!otevrene}>
            {[0, 1].map((i) => {
              const c = michani && otevrene && telefon ? zamichani(i) : cil(i);
              return (
                <motion.div
                  key={i}
                  className={s.karta}
                  style={{ zIndex: otevrene && telefon ? (vrch === i ? 3 : 2) : 2 - i }}
                  initial={false}
                  animate={c.animate}
                  transition={c.transition}
                  role="group"
                  aria-label={i ? "Menu pro děti" : "Menu"}
                  onClick={otevrene && telefon && predni !== i ? () => naKartu(i) : undefined}
                >
                  {i ? <StranaDeti /> : <StranaDospeli />}
                </motion.div>
              );
            })}
          </div>

          {/* Přední díl kapsy s výřezem na palec — před kartami, nese název. */}
          <motion.div
            className={s.kapsaPredni}
            initial={false}
            {...kapsa}
            style={{ pointerEvents: otevrene ? "none" : "auto" }}
          >
            <svg className={s.kapsaTvar} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path className={s.kapsaPlocha} d="M0 0 H38 C42 0 43 9 50 9 C57 9 58 0 62 0 H100 V100 H0 Z" />
              <path
                className={s.kapsaLinka}
                d="M4 4 H36.5 C40.5 4 42 13 50 13 C58 13 59.5 4 63.5 4 H96 V96 H4 Z"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <button
              type="button"
              className={s.kapsaTlacitko}
              onClick={prepni}
              aria-expanded={otevrene}
              aria-controls="menu-v3-obsah"
              aria-label="Vytáhnout svatební menu"
              tabIndex={otevrene ? -1 : 0}
            >
              <span className={s.kapsaNazev}>Menu</span>
              <span className={s.kapsaMonogram}>K &amp; J</span>
              <span className={s.kapsaDatum}>18 · 09 · 2027</span>
            </button>
          </motion.div>
        </div>

        <div className={s.ovladani}>
          {otevrene && telefon && (
            <div className={s.prepinac} role="group" aria-label="Která karta je navrchu">
              <button type="button" aria-pressed={predni === 0} onClick={() => naKartu(0)}>Menu</button>
              <button type="button" aria-pressed={predni === 1} onClick={() => naKartu(1)}>Pro děti</button>
            </div>
          )}
          <button
            type="button"
            className={s.tlacitko}
            onClick={prepni}
            aria-expanded={otevrene}
            aria-controls="menu-v3-obsah"
          >
            {otevrene ? "Zasunout zpět" : "Vytáhnout menu"}
          </button>
        </div>
      </div>
    </MotionConfig>
  );
}
