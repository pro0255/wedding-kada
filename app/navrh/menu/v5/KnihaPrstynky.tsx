"use client";

import { useEffect, useRef } from "react";
import Kniha from "../v1/Kniha";
import type { Prstynky } from "./prstynky";
import s from "./kniha5.module.css";

/* Návrh 5 — DOM kniha z návrhu 1 beze změny a vedle ní na stole dva zlaté
   prstýnky ve WebGL (stejné zlato jako prsten v úvodu webu) a svatební
   květiny v pravých barvách.

   Prstýnky jsou jen ozdoba: three.js se stáhne, až se sekce blíží
   k obrazovce, a kreslí se jen při otevření/zavření knihy (záblesk).
   Bez WebGL prostě nejsou, kniha funguje dál. */

const KVETINY: { soubor: string; trida: string }[] = [
  { soubor: "4_karafiat_broskvovy.webp", trida: "k1" },
  { soubor: "06_hortenzie.webp", trida: "k2" },
  { soubor: "09_pivonka.webp", trida: "k3" },
  { soubor: "12_ostrozka_modra.webp", trida: "k4" },
  { soubor: "pivonka_zluta (1).webp", trida: "k5" },
  { soubor: "10_gerbera.webp", trida: "k6" },
  { soubor: "6_pomnenky.webp", trida: "k7" },
];

export default function KnihaPrstynky() {
  const misto = useRef<HTMLDivElement>(null);
  const prstynky = useRef<Prstynky | null>(null);

  useEffect(() => {
    const el = misto.current;
    if (!el) return;
    const ac = new AbortController();
    let hlidac: IntersectionObserver | undefined;
    const priblizeni = new IntersectionObserver(
      (z) => {
        if (!z.some((x) => x.isIntersecting)) return;
        priblizeni.disconnect();
        const klid = matchMedia("(prefers-reduced-motion: reduce)").matches;
        import("./prstynky")
          .then((m) => m.vytvorPrstynky(el, { klid, signal: ac.signal }))
          .then((p) => {
            prstynky.current = p;
            hlidac = new IntersectionObserver((zz) => p.viditelnost(zz.some((x) => x.isIntersecting)));
            hlidac.observe(el);
          })
          .catch(() => {
            /* bez WebGL zůstane jen kniha */
          });
      },
      { rootMargin: "400px 0px" },
    );
    priblizeni.observe(el);
    return () => {
      ac.abort();
      priblizeni.disconnect();
      hlidac?.disconnect();
      prstynky.current?.dispose();
      prstynky.current = null;
    };
  }, []);

  return (
    <div className={s.stul}>
      {/* Květiny leží pod knihou (jsou v DOM dřív), kniha je překryje. */}
      <div className={s.kvetiny} aria-hidden="true">
        {KVETINY.map((k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={k.soubor}
            className={s.kvet + " " + s[k.trida]}
            src={`/kytky/${encodeURIComponent(k.soubor)}`}
            alt=""
            loading="lazy"
            decoding="async"
          />
        ))}
      </div>
      <Kniha
        onZmena={() => prstynky.current?.zablesk()}
        podKnihou={<div ref={misto} className={s.prstynky} aria-hidden="true" />}
      />
    </div>
  );
}
