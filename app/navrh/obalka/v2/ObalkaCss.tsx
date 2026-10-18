"use client";

import { useEffect, useId, useRef } from "react";
import { PRIBEH } from "../_spolecne/pribeh";
import s from "./obalka.module.css";
import { BOK_L, BOK_P, CHLOPEN, CHLOPEN_RUB, CHLOPEN_RUB_PODSIVKA, Defs, SPODEK, Zrno } from "../_spolecne/svg";
import { predehrat, pripojOvladani, vytvorPripravenost } from "../_spolecne/plynulost";

/* V2 — CSS 3D bez JS animací. Klik jen přepne data-otevreno, celou
   choreografii (pečeť se rozlomí → chlopeň se otočí na pantu → přeložený dopis
   vyjede → předklopí se dopředu a rozloží) řídí přechody se zpožděním.
   Zavírání má vlastní zpoždění v opačném pořadí.

   Plynulost: animuje se jen transform a opacity, žádné filtry (měkké stíny
   jsou vrstvené obrysy, ne blur). Pohyblivé vrstvy dostanou will-change jen
   kolem animace a skryté plochy se po načtení jednou předehřejí — viz
   _spolecne/plynulost.ts. Pořadí vrstev řeší z-index přepnutý v přesný
   okamžik (přechod 0s + zpoždění) — spolehlivější než translateZ
   v preserve-3d, kde Safari občas prohodí roviny.

   Klik se React stavu záměrně vyhýbá: nativní posluchače přepnou jen pár
   atributů přímo v DOM (data-otevreno, aria-*, inert) a práci rozloží do
   snímků (_spolecne/plynulost.ts → pripojOvladani). Překreslení komponenty
   s celým dopisem a SVG stálo v dev režimu při 4× zpomaleném CPU ~70 ms —
   přesně v prvním snímku animace (záškub na startu zavírání).

   Textura papíru: ambientCG „Paper002“ (CC0, https://ambientcg.com/view?id=Paper002),
   zmenšená na public/navrh/obalka/papir.webp. Pečeť: public/obalka/vosk.webp (z webu). */

function ObsahDopisu() {
  return (
    <>
      <p className={s.eyebrow}>{PRIBEH.eyebrow}</p>
      <h2 className={s.nadpis}>{PRIBEH.nadpis}</h2>
      <p className={s.text}>{PRIBEH.text}</p>
      <p className={s.podpis}>{PRIBEH.podpis}</p>
    </>
  );
}

const POPIS = { zavreno: "Otevřít obálku s naším příběhem", otevreno: "Zavřít dopis" };
// délky choreografie v CSS (poslední přechod + rezerva)
const DELKA_OTEVRENI_MS = 2900;
const DELKA_ZAVRENI_MS = 2500;

/* Měkký stín bez filtru: pár posunutých kopií tvaru s nízkým krytím. */
function MekkyStin({ d, dy, barva, kryti }: { d: string; dy: number; barva: string; kryti: number }) {
  return (
    <>
      {[0.35, 0.65, 1].map((k) => (
        <path key={k} d={d} transform={`translate(0,${dy * k})`} fill={barva} opacity={kryti / 2.2} />
      ))}
    </>
  );
}

export default function ObalkaCss() {
  const rawId = useId();
  const p = "o" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  const idDopisu = p + "dopis";
  const koren = useRef<HTMLDivElement>(null);
  const tlacitko = useRef<HTMLButtonElement>(null);
  const dopis = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const k = koren.current, t = tlacitko.current, d = dopis.current;
    if (!k || !t || !d) return;
    const pr = vytvorPripravenost(k);
    const zrusPredehrati = predehrat(k, ["/obalka/vosk.webp", "/navrh/obalka/papir.webp"], pr);
    // CSS přechody se spustí samy změnou data-otevreno (nastaví ho pripojOvladani)
    const zrusOvladani = pripojOvladani({
      koren: k,
      tlacitko: t,
      dopis: d,
      popis: POPIS,
      pripravenost: pr,
      spust: () => {},
      delka: (otevrit) => (otevrit ? DELKA_OTEVRENI_MS : DELKA_ZAVRENI_MS),
    });
    return () => {
      zrusOvladani();
      zrusPredehrati();
      pr.zrus();
    };
  }, []);

  return (
    <div ref={koren} className={s.obalka} data-otevreno="false">
      {/* zadní stěna (vnitřek je vidět, až se chlopeň zvedne) */}
      <svg className={s.zadek} viewBox="0 0 160 100" aria-hidden="true">
        <Defs p={p} />
        <rect width="160" height="100" rx="2" fill={`url(#${p}zadek)`} />
        <Zrno p={p} d="M0,0 H160 V100 H0 Z" />
      </svg>

      {/* dopis: zdvih = vyjetí z kapsy; usazení = dopředu a narovnat */}
      <div className={s.zdvih}>
        <div
          ref={dopis}
          className={s.usazeni}
          id={idDopisu}
          aria-hidden="true"
          inert
        >
          <div className={s.polovinaHorni}>
            <div className={s.obsah}>
              <ObsahDopisu />
            </div>
          </div>
          {/* spodní půlka je přeložená dopředu přes horní; rub nese monogram */}
          <div className={s.polovinaDolni} aria-hidden="true">
            <div className={s.dolniLic}>
              <div className={`${s.obsah} ${s.obsahDolni}`}>
                <ObsahDopisu />
              </div>
              <span className={s.dolniStin} />
            </div>
            <div className={s.dolniRub}>
              <span className={s.monogram}>K &amp; J</span>
            </div>
          </div>
        </div>
      </div>

      {/* kapsa: boky a spodní cíp, statické SVG na vlastní vrstvě */}
      <svg className={s.kapsa} viewBox="0 0 160 100" aria-hidden="true">
        <Defs p={p + "k"} />
        <path d={BOK_L} fill={`url(#${p}kbokL)`} />
        <Zrno p={p + "k"} d={BOK_L} />
        <path d={BOK_P} fill={`url(#${p}kbokP)`} />
        <Zrno p={p + "k"} d={BOK_P} />
        {/* měkký stín spodního cípu na boky */}
        <MekkyStin d={SPODEK} dy={-1.4} barva="#7d8fa1" kryti={0.18} />
        <path d={SPODEK} fill={`url(#${p}kspodek)`} />
        <Zrno p={p + "k"} d={SPODEK} />
        <path d="M0.6,99.6 L73,49 Q80,44 87,49 L159.4,99.6" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.35" />
      </svg>

      {/* stín zavřené chlopně na kapse — při otevření jen zmizí (opacity) */}
      <svg className={s.chlopenStin} viewBox="0 0 160 58" aria-hidden="true">
        <MekkyStin d={CHLOPEN} dy={2.4} barva="#5d6f82" kryti={0.28} />
      </svg>

      {/* chlopeň na pantu: líc + rub s podšívkou */}
      <div className={s.chlopen} aria-hidden="true">
        <svg className={s.chlopenLic} viewBox="0 0 160 58">
          <Defs p={p + "c"} />
          <path d={CHLOPEN} fill={`url(#${p}cchlopen)`} />
          <Zrno p={p + "c"} d={CHLOPEN} />
          <path d="M0.4,0.4 L72,52 Q80,58 88,52 L159.6,0.4" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.35" />
        </svg>
        <svg className={s.chlopenRub} viewBox="0 0 160 58">
          <Defs p={p + "r"} />
          <path d={CHLOPEN_RUB} fill="#c3d0dc" />
          <path d={CHLOPEN_RUB_PODSIVKA} fill={`url(#${p}rpodsivka)`} />
          <Zrno p={p + "r"} d={CHLOPEN_RUB} />
        </svg>
      </div>

      {/* pečeť ze dvou půlek — při otevření se rozlomí a odpadne */}
      <span className={s.pecet} aria-hidden="true">
        <span className={s.pecetL} />
        <span className={s.pecetP} />
      </span>

      <button
        ref={tlacitko}
        type="button"
        className={s.tlacitko}
        aria-expanded="false"
        aria-controls={idDopisu}
        aria-label={POPIS.zavreno}
      />
    </div>
  );
}
