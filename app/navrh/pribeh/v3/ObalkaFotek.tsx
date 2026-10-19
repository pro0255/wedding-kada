"use client";

/* Obálka plná fotek. Zavřená leží velká uprostřed sekce, pečetí nahoru.
   Klepnutí na pečeť: pečeť praskne, chlopeň se otevře, obálka sjede dolů
   a z ní vyjedou karty — dopis a všechny fotky — a rozloží se nad ní do
   vějíře jako karty v ruce. Vpředu (zvětšená, rovně) je vždy jedna karta,
   nejdřív dopis. Klepnutí na jinou kartu ji pošle dopředu, klepnutí na tu
   vpředu listuje dál; šipky, klávesnice a tah prstem taky.

   Všechny díly obálky i vrstva s kartami jsou sourozenci v jednom „světě“
   (.svet), takže karty můžou být nejdřív ZA přední kapsou (uvnitř obálky)
   a po vytažení nad ní — přepne se jen z-index vrstvy, ve chvíli, kdy jsou
   karty celé nad hranou obálky a nic se nepřekrývá.

   Polohy karet se počítají z šířky scény (geo), stejné zlomky má CSS.
   Animuje se jen transform a opacity (GSAP), z-index se jen přepíná. Stav
   pro React (otevřeno, vybraná karta) jde přes startTransition, animace se
   spouští přímo v obsluze klepnutí, ne až po překreslení. */

import { startTransition, useCallback, useEffect, useId, useRef, useState } from "react";
import gsap from "gsap";
import { BOK_L, BOK_P, CHLOPEN, CHLOPEN_RUB, CHLOPEN_RUB_PODSIVKA, Defs, SPODEK, Zrno } from "@/app/pribeh/svg";
import { DOPIS, FOTKY } from "../data";
import s from "./obalka.module.css";

// karta 0 je dopis, za ní fotky
const POCET = FOTKY.length + 1;
const TAH_PX = 40;

/* Geometrie ve zlomcích šířky scény W — musí sedět s obalka.module.css
   (tam v cqw). Pod 600 px šířky scény platí telefonní hodnoty. */
type Geo = {
  W: number;
  envTop: number; envH: number;
  fan: number; apex: number; R: number; maxUhel: number;
  selY: number; cardH: number;
  svetY: number; svetScale: number;
};
function geo(W: number, cardH: number): Geo {
  const tel = W < 600;
  const envTop = (tel ? 0.845 : 0.43) * W;
  const envH = (tel ? 0.525 : 0.2875) * W;
  // střed zavřené obálky se posune do středu scény a obálka se zvětší
  const stageH = (tel ? 1.4 : 0.74) * W;
  const envStred = envTop + envH / 2;
  return {
    W, envTop, envH, cardH,
    fan: tel ? 0.45 : 0.5,
    apex: (tel ? 0.24 : 0.15) * W,
    R: (tel ? 0.48 : 0.56) * W,
    maxUhel: tel ? 34 : 46,
    selY: cardH / 2 + (tel ? 0.02 : 0.012) * W,
    svetY: stageH / 2 - envStred,
    svetScale: tel ? 1.08 : 1.3,
  };
}

// drobné „náhodné“ natočení a posun karet v obálce — pevné, ať se neliší mezi rendery
const jitter = (i: number) => ({ x: ((i * 37) % 11) - 5, r: ((i * 53) % 9) - 4 });

const uvnitr = (g: Geo, i: number) => ({
  x: (jitter(i).x / 100) * g.W * 0.4,
  y: g.envTop + g.envH * 0.55,
  rotation: jitter(i).r,
  scale: g.fan * 0.95,
});
const venku = (g: Geo, i: number) => ({
  x: (jitter(i).x / 100) * g.W * 0.8,
  y: g.envTop - (g.cardH * g.fan) / 2 - 0.01 * g.W,
  rotation: jitter(i).r * 1.5,
  scale: g.fan,
});
const veVejiri = (g: Geo, i: number, vybrana: number) => {
  if (i === vybrana) return { x: 0, y: g.selY, rotation: 0, scale: 1 };
  const uhel = -g.maxUhel + (i * 2 * g.maxUhel) / (POCET - 1);
  const rad = (uhel * Math.PI) / 180;
  return {
    x: g.R * Math.sin(rad),
    y: g.apex + g.R * (1 - Math.cos(rad)),
    rotation: uhel,
    scale: g.fan,
  };
};

export default function ObalkaFotek() {
  const p = "f" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [otevreno, setOtevreno] = useState(false);
  const [vybrana, setVybrana] = useState(0);

  const scena = useRef<HTMLDivElement>(null);
  const svet = useRef<HTMLDivElement>(null);
  const vrstva = useRef<HTMLDivElement>(null);
  const karty = useRef<(HTMLButtonElement | null)[]>([]);
  const chlopen = useRef<HTMLDivElement>(null);
  const chlopenStin = useRef<SVGSVGElement>(null);
  const pecetL = useRef<HTMLSpanElement>(null);
  const pecetP = useRef<HTMLSpanElement>(null);
  // stav pro animace — mimo React, ať klepnutí nečeká na render
  const st = useRef({ otevreno: false, vybrana: 0, zaneprazdneno: false });
  const tl = useRef<gsap.core.Timeline | null>(null);
  const tah = useRef<{ x: number; y: number } | null>(null);
  const tahlo = useRef(false);

  const zmer = useCallback((): Geo | null => {
    const el = scena.current;
    const k = karty.current[0];
    if (!el || !k) return null;
    return geo(el.clientWidth, k.offsetHeight);
  }, []);

  const tlumeno = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // výchozí stav a přepočet při změně šířky
  useEffect(() => {
    const el = scena.current;
    if (!el) return;
    const rozestav = () => {
      const g = zmer();
      if (!g) return;
      const ks = karty.current.filter(Boolean) as HTMLElement[];
      gsap.set(ks, { xPercent: -50, yPercent: -50 });
      if (st.current.otevreno) {
        ks.forEach((k, i) => gsap.set(k, { ...veVejiri(g, i, st.current.vybrana), zIndex: i === st.current.vybrana ? 100 : i + 1 }));
        gsap.set(svet.current, { y: 0, scale: 1 });
      } else {
        ks.forEach((k, i) => gsap.set(k, { ...uvnitr(g, i), zIndex: i + 1 }));
        gsap.set(svet.current, { y: g.svetY, scale: g.svetScale });
      }
    };
    gsap.set(chlopen.current, { transformPerspective: 1400, transformOrigin: "50% 0%", rotationX: 0 });
    rozestav();
    const ro = new ResizeObserver(() => {
      if (!st.current.zaneprazdneno) rozestav();
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      tl.current?.kill();
    };
  }, [zmer]);

  const otevri = () => {
    const g = zmer();
    if (!g || st.current.zaneprazdneno || st.current.otevreno) return;
    st.current = { otevreno: true, vybrana: 0, zaneprazdneno: true };
    startTransition(() => {
      setOtevreno(true);
      setVybrana(0);
    });
    const ks = karty.current.filter(Boolean) as HTMLElement[];
    const vytazeno = 0.85 + 0.55 + 0.025 * (POCET - 1);
    const t = gsap.timeline({ onComplete: () => { st.current.zaneprazdneno = false; } });
    t.to(pecetL.current, { xPercent: -40, yPercent: 45, rotation: -28, opacity: 0, duration: 0.55, ease: "power2.out" }, 0)
      .to(pecetP.current, { xPercent: 40, yPercent: 58, rotation: 24, opacity: 0, duration: 0.55, ease: "power2.out" }, 0.02)
      .to(chlopenStin.current, { opacity: 0, duration: 0.25 }, 0.15)
      .to(chlopen.current, { rotationX: 180, duration: 0.75, ease: "power2.inOut" }, 0.15)
      .set(chlopen.current, { zIndex: 0 }, 0.55)
      .to(svet.current, { y: 0, scale: 1, duration: 0.9, ease: "power2.inOut" }, 0.1)
      // karty vyjedou z obálky — poslední (nejspodnější) první
      .to(ks, {
        x: (i: number) => venku(g, i).x,
        y: (i: number) => venku(g, i).y,
        rotation: (i: number) => venku(g, i).rotation,
        scale: g.fan,
        duration: 0.55, ease: "power2.out",
        stagger: { each: 0.025, from: "end" },
      }, 0.85)
      // jsou celé nad hranou obálky → vrstva karet jde před kapsu
      .set(vrstva.current, { zIndex: 6 }, vytazeno)
      .set(ks, { zIndex: (i: number) => (i === 0 ? 100 : i + 1) }, vytazeno)
      .to(ks, {
        x: (i: number) => veVejiri(g, i, 0).x,
        y: (i: number) => veVejiri(g, i, 0).y,
        rotation: (i: number) => veVejiri(g, i, 0).rotation,
        scale: (i: number) => veVejiri(g, i, 0).scale,
        duration: 0.8, ease: "power3.out",
        stagger: 0.02,
      }, vytazeno + 0.02);
    tl.current = t;
    if (tlumeno()) t.progress(1);
  };

  const zavri = () => {
    const g = zmer();
    if (!g || st.current.zaneprazdneno || !st.current.otevreno) return;
    st.current = { otevreno: false, vybrana: 0, zaneprazdneno: true };
    startTransition(() => setOtevreno(false));
    const ks = karty.current.filter(Boolean) as HTMLElement[];
    const nad = 0.5 + 0.015 * (POCET - 1);
    const t = gsap.timeline({ onComplete: () => { st.current.zaneprazdneno = false; } });
    t.to(ks, {
      x: (i: number) => venku(g, i).x,
      y: (i: number) => venku(g, i).y,
      rotation: (i: number) => venku(g, i).rotation,
      scale: g.fan,
      duration: 0.5, ease: "power2.inOut",
      stagger: 0.015,
    }, 0)
      .set(vrstva.current, { zIndex: 2 }, nad)
      .set(ks, { zIndex: (i: number) => i + 1 }, nad)
      .to(ks, {
        x: (i: number) => uvnitr(g, i).x,
        y: (i: number) => uvnitr(g, i).y,
        rotation: (i: number) => uvnitr(g, i).rotation,
        scale: g.fan * 0.95,
        duration: 0.45, ease: "power2.in",
        stagger: 0.01,
      }, nad + 0.02)
      .to(chlopen.current, { rotationX: 0, duration: 0.7, ease: "power2.inOut" }, nad + 0.4)
      .set(chlopen.current, { zIndex: 4 }, nad + 0.75)
      .to(chlopenStin.current, { opacity: 1, duration: 0.3 }, nad + 0.95)
      .to([pecetL.current, pecetP.current], { xPercent: 0, yPercent: 0, rotation: 0, opacity: 1, duration: 0.4, ease: "back.out(1.6)" }, nad + 1.0)
      .to(svet.current, { y: g.svetY, scale: g.svetScale, duration: 0.85, ease: "power2.inOut" }, nad + 0.6);
    tl.current = t;
    if (tlumeno()) t.progress(1);
  };

  const vyber = (i: number) => {
    const g = zmer();
    if (!g || st.current.zaneprazdneno || !st.current.otevreno) return;
    const n = (i + POCET) % POCET;
    st.current.vybrana = n;
    startTransition(() => setVybrana(n));
    const ks = karty.current.filter(Boolean) as HTMLElement[];
    // vybraná jde hned dopředu, ostatní se vrací na svá místa ve vějíři
    gsap.set(ks, { zIndex: (j: number) => (j === n ? 100 : j + 1) });
    gsap.to(ks, {
      x: (j: number) => veVejiri(g, j, n).x,
      y: (j: number) => veVejiri(g, j, n).y,
      rotation: (j: number) => veVejiri(g, j, n).rotation,
      scale: (j: number) => veVejiri(g, j, n).scale,
      duration: tlumeno() ? 0 : 0.6, ease: "power3.out",
      overwrite: "auto",
    });
  };

  const naKartu = (i: number) => {
    if (tahlo.current) { tahlo.current = false; return; }
    if (i === st.current.vybrana) vyber(i + 1);
    else vyber(i);
  };

  const popisek = vybrana === 0 ? "Dopis" : `${vybrana} / ${FOTKY.length}`;

  return (
    <div
      className={s.obal}
      onKeyDown={(e) => {
        if (!otevreno) return;
        if (e.key === "ArrowRight") { e.preventDefault(); vyber(st.current.vybrana + 1); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); vyber(st.current.vybrana - 1); }
        else if (e.key === "Escape") { e.preventDefault(); zavri(); }
      }}
    >
      <header className={s.hlavicka}>
        <p className={s.eyebrow}>Náš příběh</p>
        <h2 className={s.nadpis}>Jak to celé začalo</h2>
      </header>

      <div ref={scena} className={s.scena} data-otevreno={otevreno}>
        <div ref={svet} className={s.svet}>
          {/* zadní stěna obálky */}
          <svg className={`${s.dil} ${s.zadek}`} viewBox="0 0 160 100" preserveAspectRatio="none" aria-hidden="true">
            <Defs p={p} />
            <rect width="160" height="100" rx="2" fill={`url(#${p}zadek)`} />
            <Zrno p={p} d="M0,0 H160 V100 H0 Z" />
          </svg>

          {/* karty: dopis a fotky */}
          <div
            ref={vrstva}
            className={s.vrstva}
            inert={!otevreno}
            onPointerDown={(e) => {
              tah.current = { x: e.clientX, y: e.clientY };
              tahlo.current = false;
            }}
            onPointerUp={(e) => {
              const z = tah.current;
              tah.current = null;
              if (!z) return;
              const dx = e.clientX - z.x;
              if (Math.abs(dx) > TAH_PX && Math.abs(dx) > Math.abs(e.clientY - z.y)) {
                tahlo.current = true;
                vyber(st.current.vybrana + (dx < 0 ? 1 : -1));
              }
            }}
            onPointerCancel={() => { tah.current = null; }}
          >
            <button
              ref={(el) => { karty.current[0] = el; }}
              type="button"
              className={`${s.karta} ${s.dopis}`}
              aria-label={vybrana === 0 ? "Dopis — další karta" : "Ukázat dopis"}
              onClick={() => naKartu(0)}
            >
              <span className={s.osloveni}>Milí hosté,</span>
              <span className={s.text}>{DOPIS}</span>
              <span className={s.podpis}>Kačka &amp; Kuba</span>
            </button>
            {FOTKY.map((f, j) => (
              <button
                key={f.src}
                ref={(el) => { karty.current[j + 1] = el; }}
                type="button"
                className={`${s.karta} ${s.polaroid}`}
                aria-label={vybrana === j + 1 ? `${f.popis} — další karta` : `Ukázat fotku: ${f.popis}`}
                onClick={() => naKartu(j + 1)}
              >
                <img src={f.src} alt="" loading="lazy" decoding="async" draggable={false} />
                <span className={s.popis}>{f.popis}</span>
              </button>
            ))}
          </div>

          {/* přední kapsa */}
          <svg className={`${s.dil} ${s.kapsa}`} viewBox="0 0 160 100" preserveAspectRatio="none" aria-hidden="true">
            <Defs p={p + "k"} />
            <path d={BOK_L} fill={`url(#${p}kbokL)`} />
            <Zrno p={p + "k"} d={BOK_L} />
            <path d={BOK_P} fill={`url(#${p}kbokP)`} />
            <Zrno p={p + "k"} d={BOK_P} />
            <path d={SPODEK} transform="translate(0,-1.2)" fill="#7d8fa1" opacity="0.18" style={{ filter: "blur(1.2px)" }} />
            <path d={SPODEK} fill={`url(#${p}kspodek)`} />
            <Zrno p={p + "k"} d={SPODEK} />
            <path d="M0.6,99.6 L73,49 Q80,44 87,49 L159.4,99.6" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.35" />
          </svg>

          <div className={`${s.dil} ${s.vrchniDily}`} aria-hidden="true">
            <svg ref={chlopenStin} className={s.chlopenStin} viewBox="0 0 160 58" preserveAspectRatio="none">
              <path d={CHLOPEN} transform="translate(0,2.2)" fill="#5d6f82" opacity="0.28" style={{ filter: "blur(1.2px)" }} />
            </svg>
          </div>
          <div ref={chlopen} className={`${s.dil} ${s.chlopen}`} aria-hidden="true">
            <svg className={s.chlopenLic} viewBox="0 0 160 58" preserveAspectRatio="none">
              <Defs p={p + "c"} />
              <path d={CHLOPEN} fill={`url(#${p}cchlopen)`} />
              <Zrno p={p + "c"} d={CHLOPEN} />
              <path d="M0.4,0.4 L72,52 Q80,58 88,52 L159.6,0.4" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.35" />
            </svg>
            <svg className={s.chlopenRub} viewBox="0 0 160 58" preserveAspectRatio="none">
              <Defs p={p + "r"} />
              <path d={CHLOPEN_RUB} fill="#a9bccd" />
              <path d={CHLOPEN_RUB_PODSIVKA} fill={`url(#${p}rpodsivka)`} />
              <Zrno p={p + "r"} d={CHLOPEN_RUB} />
            </svg>
          </div>

          <div className={`${s.dil} ${s.pecetMisto}`} aria-hidden="true">
            <span className={s.pecet}>
              <span ref={pecetL} className={s.pecetL} />
              <span ref={pecetP} className={s.pecetP} />
            </span>
          </div>

          {!otevreno && (
            <button type="button" className={`${s.dil} ${s.otevrit}`} onClick={otevri} aria-label="Otevřít obálku s fotkami a dopisem" />
          )}
        </div>
      </div>

      {/* Pod scénou pevně vysoký řádek: pokyn, nebo ovládání vějíře. */}
      <div className={s.pod}>
        {otevreno ? (
          <div className={s.ovladani}>
            <button type="button" className={s.sipka} onClick={() => vyber(vybrana - 1)} aria-label="Předchozí karta">‹</button>
            <span className={s.pocet} aria-live="polite">{popisek}</span>
            <button type="button" className={s.sipka} onClick={() => vyber(vybrana + 1)} aria-label="Další karta">›</button>
            <button type="button" className={s.zavrit} onClick={zavri}>Zavřít obálku</button>
          </div>
        ) : (
          <p className={s.pokyn}>Klepněte na pečeť</p>
        )}
      </div>
    </div>
  );
}
