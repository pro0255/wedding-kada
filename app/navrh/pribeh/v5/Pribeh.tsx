"use client";

import { useEffect, useRef } from "react";
import { FOTKY, VETY } from "../data";
import s from "./pribeh.module.css";

/* Příběh při scrollu. Sekce je vysoká několik obrazovek, scéna uvnitř stojí
   (position: sticky) a posouvání stránky jen přepíná kroky: v každém kroku
   naskočí jedna věta dopisu a na hromádku přibydou fotky, které k ní patří.
   Poslední krok je podpis.

   Krok hlídá IntersectionObserver na neviditelných značkách — žádný scroll
   listener ani React stav. Stav se zapíše rovnou do DOM (data-stav na větách
   a fotkách), animace dělají CSS přechody jen na transform a opacity. */

// fotky ke každé větě (indexy do FOTKY) — všech patnáct, každá jednou
const K_VETAM: number[][] = [
  [12, 13], // Pět let spolu, zásnuby na Troskách… (zásnuby navrch)
  [0, 1, 2], // Poznali jsme se, zamilovali se
  [3, 4, 5], // krásné i náročnější chvíle
  [6, 7, 8], // domov plný smíchu
  [9, 10, 11], // bok po boku
  [14], // 18. září 2027
];
const KROKU = VETY.length + 1; // + podpis

/* Kam fotka na stole dopadne: posun v % plochy stolu a natočení. Ručně
   rozházené, ať hromádka nevypadá jako mřížka; novější leží navrch. */
const POLOHY = [
  { x: -6, y: 4, r: -7 }, { x: 8, y: -4, r: 5 }, { x: -2, y: 10, r: 2 },
  { x: 12, y: 6, r: -4 }, { x: -10, y: -6, r: 8 }, { x: 4, y: 2, r: -2 },
  { x: -8, y: 12, r: 4 }, { x: 10, y: -8, r: -6 }, { x: 0, y: -2, r: 3 },
  { x: -12, y: 2, r: -3 }, { x: 6, y: 12, r: 6 }, { x: 14, y: -2, r: -8 },
  { x: -4, y: -10, r: 2 }, { x: 2, y: 8, r: -5 }, { x: -1, y: 0, r: 1 },
];

// pořadí pokládání: fotky seřazené podle kroku, ve kterém přijdou na stůl
const POLOZENI = K_VETAM.flatMap((fotky, krok) => fotky.map((f) => ({ f, krok })));

export default function Pribeh() {
  const koren = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = koren.current;
    if (!el) return;
    const vety = el.querySelectorAll<HTMLElement>("[data-veta]");
    const fotky = el.querySelectorAll<HTMLElement>("[data-fotka]");
    const podpis = el.querySelector<HTMLElement>("[data-podpis]");
    let aktualni = 0;

    const nastav = (krok: number) => {
      if (krok === aktualni) return;
      aktualni = krok;
      // v posledním kroku (podpis) zůstává poslední věta rozsvícená
      const veta = Math.min(krok, VETY.length - 1);
      vety.forEach((v) => {
        const i = Number(v.dataset.veta);
        v.dataset.stav = i < veta ? "minula" : i === veta ? "ted" : "budouci";
      });
      fotky.forEach((f) => {
        f.dataset.stav = Number(f.dataset.krok) <= krok ? "polozena" : "budouci";
      });
      if (podpis) podpis.dataset.stav = krok >= KROKU - 1 ? "ted" : "budouci";
      // u podpisu se na počítači rozsvítí celý dopis (viz CSS)
      el.toggleAttribute("data-konec", krok >= KROKU - 1);
    };

    /* Značka kroku se „trefí“, když protne vodorovnou čáru uprostřed okna.
       Při rychlém scrollu může protnout víc značek najednou — bere se ta
       poslední. */
    const io = new IntersectionObserver(
      (zaznamy) => {
        const zasah = zaznamy.filter((z) => z.isIntersecting);
        if (!zasah.length) return;
        nastav(Math.max(...zasah.map((z) => Number((z.target as HTMLElement).dataset.znacka))));
      },
      { rootMargin: "-50% 0px -50% 0px" },
    );
    el.querySelectorAll("[data-znacka]").forEach((z) => io.observe(z));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={koren} className={s.pribeh} style={{ "--kroku": KROKU } as React.CSSProperties}>
      <div className={s.scena}>
        <div className={s.text}>
          <p className={s.stitek}>Náš příběh</p>
          <h2 className={s.nadpis}>Jak to celé začalo</h2>
          {/* Celý dopis je v DOM od začátku — čtečky ho přečtou celý. */}
          <p className={s.dopis}>
            {VETY.map((v, i) => (
              <span key={i} className={s.veta} data-veta={i} data-stav={i === 0 ? "ted" : "budouci"}>
                {v}{" "}
              </span>
            ))}
          </p>
          <p className={s.podpis} data-podpis data-stav="budouci">
            <span className={s.podpisJmena}>Kačka &amp; Kuba</span>
            <span className={s.podpisDatum}>18. září 2027 · u zvoničky v Rekovicích</span>
          </p>
        </div>

        <div className={s.stul} aria-label="Fotky z našeho příběhu" role="group">
          {POLOZENI.map(({ f, krok }, poradi) => {
            const p = POLOHY[poradi];
            return (
              <figure
                key={f}
                className={s.polaroid}
                data-fotka
                data-krok={krok}
                data-stav={krok === 0 ? "polozena" : "budouci"}
                style={{ "--x": `${p.x}%`, "--y": `${p.y}%`, "--r": `${p.r}deg`, zIndex: poradi + 1 } as React.CSSProperties}
              >
                <img src={FOTKY[f].src} alt={FOTKY[f].popis} loading="lazy" decoding="async" draggable={false} />
                <figcaption>{FOTKY[f].popis}</figcaption>
              </figure>
            );
          })}
        </div>
      </div>

      {/* Neviditelné značky kroků, každá vysoká kus obrazovky. */}
      <div className={s.znacky} aria-hidden="true">
        {Array.from({ length: KROKU }, (_, i) => (
          <span key={i} data-znacka={i} />
        ))}
      </div>
    </div>
  );
}
