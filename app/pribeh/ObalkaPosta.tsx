"use client";

import { useEffect, useId, useRef } from "react";
import gsap from "gsap";
import { predehrat, pripojOvladani, vytvorPripravenost } from "./plynulost";
import { BOK_L, BOK_P, CHLOPEN, CHLOPEN_RUB, CHLOPEN_RUB_PODSIVKA, Defs, SPODEK, Zrno } from "./svg";
import s from "./obalka.module.css";

/* Obálka s příběhem. Leží pečetí nahoru jako v dřívější verzi webu — zlatá
   pečeť je jediný teplý akcent scény a host hned ví, kam klepnout. Jedno
   klepnutí spustí celý příběh: obálka se zvedne → pečeť praskne a odletí
   zlaté jiskry → chlopeň se otevře → dopis vyjede a rozloží se. Druhé
   klepnutí pustí tutéž timeline pozpátku a rychleji. Myš obálku jemně naklání.

   GSAP 3 (od 2025 zdarma včetně pluginů — https://gsap.com/licensing/).
   Animuje se jen transform a opacity, z-index se jen přepíná přes tl.set.
   Plynulost: klik nesahá na React stav (nativní posluchače, práce rozložená do
   snímků — plynulost.ts), timeline se při připojení jednou „protočí“
   (progress 1 → 0), takže si GSAP načte výchozí hodnoty hned, a skryté plochy
   (rub chlopně, dolní půlka dopisu) se po načtení předehřejí. Na telefonu
   se 4× pomalejším procesorem měřeno bez jediného snímku nad 25 ms.

   Text dopisu přichází zvenku (children) a vykreslí se dvakrát: horní
   a dolní půlka přeloženého listu jsou dvě kopie posunuté o výšku půlky.
   Čtečky dostanou jen tu horní. Papír: ambientCG Paper002 (CC0). */

const JISKRY = Array.from({ length: 14 }, (_, i) => {
  const uhel = (i / 14) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
  const r = 60 + (i % 3) * 28; // % velikosti pečeti
  return { x: Math.cos(uhel) * r, y: Math.sin(uhel) * r * 0.8 + 20, s: 0.5 + (i % 4) * 0.25 };
});

/* Na širokém displeji je obálka velká a rozložený dopis by vyjel přes nadpis,
   proto se usadí menší. Na telefonu je obálka užší a písmo dopisu by po
   zmenšení bylo nečitelné. Čte se jednou při připojení (viz předehřátí). */
const uzka = () => window.matchMedia("(max-width: 700px)").matches;

const POPIS = { zavreno: "Otevřít obálku s naším příběhem", otevreno: "Zavřít dopis" };

function ObsahDopisu({ children }: { children: React.ReactNode }) {
  return (
    <>
      <p className={s.osloveni}>Milí hosté,</p>
      <div className={s.text}>{children}</div>
      <p className={s.podpis}>Káťa &amp; Kuba</p>
    </>
  );
}

export default function ObalkaPosta({ children }: { children: React.ReactNode }) {
  const rawId = useId();
  const p = "o" + rawId.replace(/[^a-zA-Z0-9]/g, "");
  const idDopisu = p + "dopis";

  const koren = useRef<HTMLDivElement>(null);
  const tlacitko = useRef<HTMLButtonElement>(null);
  const dopis = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = koren.current, b = tlacitko.current, d = dopis.current;
    if (!el || !b || !d) return;
    const pr = vytvorPripravenost(el);
    const q = gsap.utils.selector(el);
    let naklonX: ((v: number) => void) | null = null;
    let naklonY: ((v: number) => void) | null = null;

    const ctx = gsap.context(() => {
      gsap.set(q(`.${s.chlopen}`), { transformPerspective: 1400, transformOrigin: "50% 0%", rotationX: 0 });
      gsap.set(q(`.${s.polovinaDolni}`), { transformPerspective: 1600, transformOrigin: "50% 0%", rotationX: 180 });
      gsap.set(q(`.${s.jiskra}`), { scale: 0, opacity: 0 });

      const t = gsap.timeline({ paused: true, onComplete: pr.konec, onReverseComplete: pr.konec });
      // 1) zvednout
      t.to(q(`.${s.zdvihKarty}`), { yPercent: -4, scale: 1.035, duration: 0.35, ease: "power2.out" }, 0)
        .to(q(`.${s.stinKarty}`), { opacity: 0.6, scale: 0.97, duration: 0.35, ease: "power2.out" }, 0)
        .to(q(`.${s.zdvihKarty}`), { yPercent: 0, scale: 1, duration: 0.45, ease: "power2.inOut" }, 0.4)
        .to(q(`.${s.stinKarty}`), { opacity: 1, scale: 1, duration: 0.45, ease: "power2.inOut" }, 0.4)
        // 2) pečeť praskne, jiskry
        .to(q(`.${s.pecetL}`), { xPercent: -40, yPercent: 45, rotation: -28, opacity: 0, duration: 0.6, ease: "power2.out" }, 0.2)
        .to(q(`.${s.pecetP}`), { xPercent: 40, yPercent: 58, rotation: 24, opacity: 0, duration: 0.6, ease: "power2.out" }, 0.22)
        .to(q(`.${s.jiskra}`), {
          keyframes: [
            { scale: 1, opacity: 1, duration: 0.12, ease: "power1.out" },
            { xPercent: (i: number) => JISKRY[i].x, yPercent: (i: number) => JISKRY[i].y, scale: (i: number) => JISKRY[i].s, opacity: 0, duration: 0.7, ease: "power3.out" },
          ],
          stagger: 0.012,
        }, 0.17)
        // 3) chlopeň
        .to(q(`.${s.chlopenStin}`), { opacity: 0, duration: 0.25 }, 0.35)
        .to(q(`.${s.chlopen}`), { rotationX: 180, duration: 0.8, ease: "power2.inOut" }, 0.35)
        .set(q(`.${s.chlopen}`), { zIndex: 0 }, 0.75)
        // 4) dopis vyjede, přeskočí nad kapsu, usadí se a rozloží
        .to(q(`.${s.zdvih}`), { yPercent: -118, duration: 0.65, ease: "power3.out" }, 1)
        .set(q(`.${s.zdvih}`), { zIndex: 6 }, 1.6)
        .to(q(`.${s.usazeni}`), { yPercent: () => (uzka() ? -22 : -8), scale: () => (uzka() ? 1.03 : 0.86), rotation: -4, duration: 0.75, ease: "back.out(1.5)" }, 1.6)
        .to(q(`.${s.polovinaDolni}`), { rotationX: 0, duration: 0.85, ease: "power3.out" }, 1.9)
        .to(q(`.${s.dolniStin}`), { opacity: 0, duration: 0.6 }, 2.15);
      // předehřátí: všechny tweeny si teď (ne v prvním snímku) přečtou výchozí
      // hodnoty; konec i návrat proběhnou v jedné úloze, takže nic nebliká
      t.progress(1).progress(0);

      // naklánění myší (jen zavřená obálka, jen zařízení s myší)
      const n = q(`.${s.naklon}`);
      naklonX = gsap.quickTo(n, "rotationY", { duration: 0.6, ease: "power3.out" });
      naklonY = gsap.quickTo(n, "rotationX", { duration: 0.6, ease: "power3.out" });

      return pripojOvladani({
        koren: el,
        tlacitko: b,
        dopis: d,
        popis: POPIS,
        pripravenost: pr,
        spust: (otevrit) => {
          naklonX?.(0);
          naklonY?.(0);
          if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            t.pause().progress(otevrit ? 1 : 0);
            pr.konec();
          } else if (otevrit) t.timeScale(1).play();
          else t.timeScale(1.7).reverse();
        },
      });
    }, el);

    const pohyb = (e: PointerEvent) => {
      if (el.dataset.otevreno === "true" || e.pointerType !== "mouse" || !naklonX || !naklonY) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const r = el.getBoundingClientRect();
      naklonX(((e.clientX - r.left) / r.width - 0.5) * 12);
      naklonY(-((e.clientY - r.top) / r.height - 0.5) * 10);
    };
    const pryc = () => {
      naklonX?.(0);
      naklonY?.(0);
    };
    el.addEventListener("pointermove", pohyb);
    el.addEventListener("pointerleave", pryc);
    const zrusPredehrati = predehrat(el, ["/obalka/vosk.webp", "/obalka/papir.webp"], pr);

    return () => {
      el.removeEventListener("pointermove", pohyb);
      el.removeEventListener("pointerleave", pryc);
      zrusPredehrati();
      pr.zrus();
      ctx.revert();
    };
  }, []);

  return (
    <div ref={koren} className={s.obalka} data-otevreno="false">
      <div className={s.stinKarty} aria-hidden="true" />
      <div className={s.naklon}>
        <div className={s.zdvihKarty}>
          <div className={s.karta}>
            {/* kapsa, chlopeň, pečeť, dopis */}
            <div className={s.plocha}>
              <svg className={s.zadek} viewBox="0 0 160 100" aria-hidden="true">
                <Defs p={p} />
                <rect width="160" height="100" rx="2" fill={`url(#${p}zadek)`} />
                <Zrno p={p} d="M0,0 H160 V100 H0 Z" />
              </svg>

              <div className={s.zdvih}>
                <div ref={dopis} className={s.usazeni} id={idDopisu} aria-hidden="true" inert>
                  <div className={s.polovinaHorni}>
                    <div className={s.obsah}>
                      <ObsahDopisu>{children}</ObsahDopisu>
                    </div>
                  </div>
                  <div className={s.polovinaDolni} aria-hidden="true">
                    <div className={s.dolniLic}>
                      <div className={`${s.obsah} ${s.obsahDolni}`}>
                        <ObsahDopisu>{children}</ObsahDopisu>
                      </div>
                      <span className={s.dolniStin} />
                    </div>
                    <div className={s.dolniRub}>
                      <span className={s.monogram}>K &amp; J</span>
                    </div>
                  </div>
                </div>
              </div>

              <svg className={s.kapsa} viewBox="0 0 160 100" aria-hidden="true">
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

              <svg className={s.chlopenStin} viewBox="0 0 160 58" aria-hidden="true">
                <path d={CHLOPEN} transform="translate(0,2.2)" fill="#5d6f82" opacity="0.28" style={{ filter: "blur(1.2px)" }} />
              </svg>

              <div className={s.chlopen} aria-hidden="true">
                <svg className={s.chlopenLic} viewBox="0 0 160 58">
                  <Defs p={p + "c"} />
                  <path d={CHLOPEN} fill={`url(#${p}cchlopen)`} />
                  <Zrno p={p + "c"} d={CHLOPEN} />
                  <path d="M0.4,0.4 L72,52 Q80,58 88,52 L159.6,0.4" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.35" />
                </svg>
                <svg className={s.chlopenRub} viewBox="0 0 160 58">
                  <Defs p={p + "r"} />
                  <path d={CHLOPEN_RUB} fill="#a9bccd" />
                  <path d={CHLOPEN_RUB_PODSIVKA} fill={`url(#${p}rpodsivka)`} />
                  <Zrno p={p + "r"} d={CHLOPEN_RUB} />
                </svg>
              </div>

              <span className={s.pecet} aria-hidden="true">
                <span className={s.pecetL} />
                <span className={s.pecetP} />
                {JISKRY.map((_, i) => (
                  <span key={i} className={s.jiskra} />
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>

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
