"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DOPIS, FOTKY } from "../data";
import s from "./film.module.css";

/* Kontaktní arch: dopis psaný na stroji a vedle něj filmový pás s fotkami.

   Pás je obyčejný vodorovný scroll se scroll-snapem — prst ho táhne nativně,
   myší se táhne přes pointer události (jen posun scrollLeft, žádný React
   stav), šipkami pod pásem a klávesami. Klepnutí na políčko otevře „lupu“:
   fotku zvětšenou nad pásem. Lupa je jediný React stav, mění se jen po
   klepnutí. */

// číslování snímků jako na okraji filmu: 1, 1A, 2, 2A…
const cislo = (i: number) => `${i + 1}`;
// tah myší kratší než tohle je klepnutí, ne posun pásu
const TAH_PX = 6;

export default function Film() {
  const pas = useRef<HTMLDivElement>(null);
  const tah = useRef<{ x: number; scroll: number; posunuto: boolean } | null>(null);
  const [lupa, setLupa] = useState<number | null>(null);
  const zavrit = useRef<HTMLButtonElement>(null);

  const posun = (smer: 1 | -1) => {
    const el = pas.current;
    if (!el) return;
    const policko = el.querySelector<HTMLElement>("li");
    el.scrollBy({ left: smer * (policko?.offsetWidth ?? 240) * 2, behavior: "smooth" });
  };

  const dalsi = useCallback((smer: 1 | -1) => {
    setLupa((i) => (i === null ? i : (i + smer + FOTKY.length) % FOTKY.length));
  }, []);

  // Esc zavře lupu, šipky v ní listují
  useEffect(() => {
    if (lupa === null) return;
    zavrit.current?.focus({ preventScroll: true });
    const klavesa = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLupa(null);
      else if (e.key === "ArrowRight") dalsi(1);
      else if (e.key === "ArrowLeft") dalsi(-1);
    };
    window.addEventListener("keydown", klavesa);
    return () => window.removeEventListener("keydown", klavesa);
  }, [lupa, dalsi]);

  return (
    <div className={s.arch}>
      <div className={s.hlava}>
        <p className={s.stitek}>Náš příběh</p>
        <h2 className={s.nadpis}>Jak to celé začalo</h2>
      </div>

      <div className={s.rozlozeni}>
        {/* Dopis na stroji. Podpis rukou — jediné, co na listu není strojem. */}
        <article className={s.list}>
          <p className={s.hlavicka}>
            <span>K &amp; J</span>
            <span>svatba 18. 9. 2027</span>
          </p>
          <p className={s.osloveni}>Milí hosté,</p>
          <p className={s.text}>{DOPIS}</p>
          <p className={s.podpis}>Káťa &amp; Kuba</p>
        </article>

        <div className={s.pasObal}>
          <div
            ref={pas}
            className={s.pas}
            tabIndex={0}
            role="group"
            aria-roledescription="filmový pás"
            aria-label="Fotky z našeho příběhu"
            onPointerDown={(e) => {
              if (e.pointerType !== "mouse" || !pas.current) return;
              tah.current = { x: e.clientX, scroll: pas.current.scrollLeft, posunuto: false };
            }}
            onPointerMove={(e) => {
              const t = tah.current;
              if (!t || !pas.current) return;
              const dx = e.clientX - t.x;
              if (!t.posunuto && Math.abs(dx) < TAH_PX) return;
              if (!t.posunuto) {
                t.posunuto = true;
                // při tažení snap vypnout, jinak by pás skákal po políčkách
                pas.current.dataset.tazeno = "true";
                pas.current.setPointerCapture(e.pointerId);
              }
              pas.current.scrollLeft = t.scroll - dx;
            }}
            onPointerUp={() => {
              const t = tah.current;
              tah.current = null;
              if (pas.current) delete pas.current.dataset.tazeno;
              // click po tažení se nemá brát jako klepnutí na políčko
              if (t?.posunuto) {
                const zrus = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
                pas.current?.addEventListener("click", zrus, { capture: true, once: true });
                setTimeout(() => pas.current?.removeEventListener("click", zrus, { capture: true }), 0);
              }
            }}
            onPointerCancel={() => {
              tah.current = null;
              if (pas.current) delete pas.current.dataset.tazeno;
            }}
          >
            <ol className={s.film}>
              {FOTKY.map((f, i) => (
                <li key={f.src} className={s.policko}>
                  <span className={s.okraj} aria-hidden="true">
                    <span>{cislo(i)}</span>
                    <span className={s.okrajA}>{cislo(i)}A</span>
                  </span>
                  <button type="button" className={s.snimek} onClick={() => setLupa(i)} aria-label={`Zvětšit: ${f.popis}`}>
                    <img src={f.src} alt="" loading="lazy" decoding="async" draggable={false} />
                  </button>
                  <span className={s.popisek}>{f.popis}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className={s.ovladani}>
            <button type="button" onClick={() => posun(-1)} aria-label="Posunout pás zpět">←</button>
            <span>{FOTKY.length} snímků · táhněte do strany</span>
            <button type="button" onClick={() => posun(1)} aria-label="Posunout pás dál">→</button>
          </div>
        </div>
      </div>

      {/* Lupa: zvětšený snímek nad pásem. Klepnutí kamkoli ji zavře. */}
      <div
        className={s.lupa}
        data-otevreno={lupa !== null}
        onClick={() => setLupa(null)}
        aria-hidden={lupa === null}
        inert={lupa === null}
      >
        {lupa !== null && (
          <figure className={s.zvetseni} role="dialog" aria-modal="true" aria-label={FOTKY[lupa].popis} onClick={(e) => e.stopPropagation()}>
            <img src={FOTKY[lupa].src} alt={FOTKY[lupa].popis} decoding="async" />
            <figcaption>
              <span className={s.zvetseniCislo}>č. {cislo(lupa)}</span>
              <span>{FOTKY[lupa].popis}</span>
            </figcaption>
            <div className={s.zvetseniOvladani}>
              <button type="button" onClick={() => dalsi(-1)} aria-label="Předchozí snímek">←</button>
              <button ref={zavrit} type="button" onClick={() => setLupa(null)}>zavřít</button>
              <button type="button" onClick={() => dalsi(1)} aria-label="Další snímek">→</button>
            </div>
          </figure>
        )}
      </div>
    </div>
  );
}
