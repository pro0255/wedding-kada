"use client";

import { useEffect, useRef, useState } from "react";
import s from "./meric.module.css";

/* Měřič plynulosti pro návrhy. Po každém klepnutí nebo klávese čtyři vteřiny
   zapisuje délku každého snímku (requestAnimationFrame) a ukáže nejdelší
   snímek a počet cuknutí — snímků nad 25 ms, tedy aspoň jednoho vypadlého
   při 60 Hz. Kde to prohlížeč umí (Chrome), přidá i Long Animation Frames:
   který skript nebo přepočet stylů snímek protáhl.

   Na skutečném telefonu tak jde ověřit to, co emulace na počítači neukáže —
   grafický čip telefonu. Výsledek je i ve window.__plynulost pro automatické
   kontroly. V iframech rozcestníku se neukazuje, byl by jich tam tucet.

   Během měření na React ani DOM nesahá: překreslení ukazatele v okamžiku
   klepnutí stálo kolem 7 ms právě v měřeném snímku a samo dělalo cuknutí.
   Výsledek se vykreslí až po skončení okna. */

type Vysledek = {
  max: number;
  cuknuti: number;
  vyrazna: number;
  snimku: number;
  hz: number;
  pricina: string[];
};

const OKNO_MS = 4000;
const CUKNUTI_MS = 25;
const VYRAZNE_MS = 50;

declare global {
  interface Window {
    __plynulost?: Vysledek[];
  }
}

type LoafSkript = { invoker?: string; duration: number; sourceFunctionName?: string };
type LoafZaznam = PerformanceEntry & {
  styleAndLayoutStart: number;
  scripts: LoafSkript[];
};

export default function MericPlynulosti() {
  const [vysledek, setVysledek] = useState<Vysledek | null>(null);
  const [rozbaleno, setRozbaleno] = useState(false);
  const [vidim, setVidim] = useState(false);
  const bezi = useRef(false);

  useEffect(() => {
    if (window.top !== window.self) return; // v iframu rozcestníku ne
    if (/^\/navrh\/?$/.test(location.pathname)) return; // rozcestník sám nic neanimuje
    setVidim(true);

    // obnovovací frekvence displeje z klidových snímků — kvůli popisku
    let hz = 60;
    const klid: number[] = [];
    let posledni = 0;
    const kalibrace = (ted: number) => {
      if (posledni) klid.push(ted - posledni);
      posledni = ted;
      if (klid.length < 60) requestAnimationFrame(kalibrace);
      else {
        const serazene = [...klid].sort((a, b) => a - b);
        hz = Math.round(1000 / serazene[Math.floor(serazene.length / 2)]);
      }
    };
    requestAnimationFrame(kalibrace);

    const zmer = (e: Event) => {
      // klepnutí na samotný ukazatel se neměří
      if (e.target instanceof Element && e.target.closest("[data-meric]")) return;
      if (bezi.current) return;
      bezi.current = true;
      const snimky: number[] = [];
      const loaf: LoafZaznam[] = [];
      let obs: PerformanceObserver | null = null;
      try {
        obs = new PerformanceObserver((l) => loaf.push(...(l.getEntries() as LoafZaznam[])));
        obs.observe({ type: "long-animation-frame", buffered: false });
      } catch {
        obs = null; // Safari a Firefox LoAF neumí — stačí snímky
      }
      const zacatek = performance.now();
      let minule = 0;
      const smycka = (ted: number) => {
        if (minule) snimky.push(ted - minule);
        minule = ted;
        if (ted - zacatek < OKNO_MS) requestAnimationFrame(smycka);
        else {
          obs?.disconnect();
          const pricina = loaf
            .filter((e) => e.duration > VYRAZNE_MS)
            .slice(0, 3)
            .map((e) => {
              const styl = Math.round(e.startTime + e.duration - e.styleAndLayoutStart);
              const skript = [...e.scripts].sort((a, b) => b.duration - a.duration)[0];
              const kdo = skript
                ? `${skript.sourceFunctionName || skript.invoker || "skript"} ${Math.round(skript.duration)} ms`
                : "bez skriptu";
              return `${Math.round(e.duration)} ms: ${kdo}, styly a rozložení ${styl} ms`;
            });
          const v: Vysledek = {
            max: Math.round(Math.max(0, ...snimky)),
            cuknuti: snimky.filter((x) => x > CUKNUTI_MS).length,
            vyrazna: snimky.filter((x) => x > VYRAZNE_MS).length,
            snimku: snimky.length,
            hz,
            pricina,
          };
          (window.__plynulost ??= []).push(v);
          setVysledek(v);
          bezi.current = false;
        }
      };
      requestAnimationFrame(smycka);
    };

    // capture: měří se i klepnutí, která stránka sama zastaví
    window.addEventListener("pointerdown", zmer, true);
    window.addEventListener("keydown", zmer, true);
    return () => {
      window.removeEventListener("pointerdown", zmer, true);
      window.removeEventListener("keydown", zmer, true);
    };
  }, []);

  if (!vidim) return null;

  const stav = !vysledek ? "nic" : vysledek.vyrazna > 0 ? "spatne" : vysledek.cuknuti > 0 ? "hrana" : "dobre";
  return (
    <div className={s.meric} data-stav={stav} data-meric aria-live="polite">
      <button
        type="button"
        className={s.pilulka}
        onClick={(e) => {
          e.stopPropagation();
          setRozbaleno((r) => !r);
        }}
        aria-expanded={rozbaleno}
      >
        <span className={s.tecka} aria-hidden="true" />
        {vysledek
          ? `Nejdelší snímek ${vysledek.max} ms · cuknutí ${vysledek.cuknuti}`
          : "Klepněte na scénu — za 4 s ukážu plynulost"}
      </button>
      {rozbaleno && vysledek && (
        <div className={s.detail}>
          <p>
            {vysledek.snimku} snímků za {OKNO_MS / 1000} s, displej {vysledek.hz} Hz.
            Cuknutí = snímek nad {CUKNUTI_MS} ms, výrazné nad {VYRAZNE_MS} ms ({vysledek.vyrazna}).
          </p>
          {vysledek.pricina.length > 0 && (
            <ul>
              {vysledek.pricina.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <p className={s.nadpis}>Historie</p>
          <ol>
            {(window.__plynulost ?? []).slice(-6).map((h, i) => (
              <li key={i}>
                max {h.max} ms · cuknutí {h.cuknuti}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
