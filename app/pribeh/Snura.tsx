"use client";

import { useEffect, useRef } from "react";
import { Grape_Nuts } from "next/font/google";
import s from "./snura.module.css";

/* Fotky z našeho příběhu na šňůře: polaroidy zavěšené na provázku dřevěnými
   kolíčky, pod nimi dopis hostům.

   Šňůra je jeden vodorovný pás, který se posouvá nativně (overflow-x se
   scroll-snapem) — prstem jako každý jiný pás na telefonu, myší tahem
   (vlastní posun scrollLeft, bez fyziky) nebo šipkami. Posun nesahá na React
   stav, takže se při něm nic nepřekresluje.

   Celá šňůra se prověšuje do paraboly: fotka v poměrné poloze t visí
   o průvěs · 4t(1 − t) níž než konce (--k, průvěs sám je v CSS a na telefonu
   menší). Provázek kreslí každá fotka sama — úsek od svého kolíčku k dalšímu,
   který se mezi nimi ještě jemně prohne pod vahou. Úsek je SVG natažené přes
   mezeru (preserveAspectRatio none) v jednotkách 0–100, kde 80 = celý průvěs
   a zbytek do 100 je místo na prohnutí. Provázek vede kousek nad horní hranou
   fotek, kolíček ho přes ni drží — je tak vidět celý, ne jen v mezerách.

   Popisky jsou text v Grape Nuts — vypadá jako popisek psaný propiskou na
   polaroid, je čitelný i v malém a má českou diakritiku (latin-ext). Dřív to
   byly obrázky s vysázeným rukopisem a měly je jen čtyři fotky z patnácti. */

const rukopis = Grape_Nuts({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--snura-rukopis",
  // sekce je hluboko pod úvodem — preload by soupeřil s hero
  preload: false,
});

export type FotkaNaSnure = { src: string; popis: string };

// střídavé natočení fotek — ať šňůra nevypadá jako řada v tabulce
const NATOCENI = [-3, 2.2, -1.4, 3, -2.4, 1.2, -3.2, 2.6, -1, 2, -2.8, 1.6, -1.8, 3.2, -2.2];

/* Úsek provázku mezi dvěma kolíčky. Výšky v jednotkách: 80 = celý průvěs. */
function Usek({ od, k, className }: { od: number; k: number; className: string }) {
  const a = od * 80, b = k * 80;
  const stred = (a + b) / 2 + 16;
  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={`M0,${a.toFixed(1)} Q50,${stred.toFixed(1)} 100,${b.toFixed(1)}`} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function Snura({ fotky, children }: { fotky: FotkaNaSnure[]; children: React.ReactNode }) {
  const pas = useRef<HTMLDivElement>(null);
  const zpet = useRef<HTMLButtonElement>(null);
  const dal = useRef<HTMLButtonElement>(null);
  const pocet = fotky.length;

  // poměrný průvěs fotky i (0 = konce šňůry, 1 = prostředek)
  const vis = (i: number) => {
    const t = (i + 0.5) / pocet;
    return 4 * t * (1 - t);
  };

  useEffect(() => {
    const el = pas.current;
    if (!el) return;

    // šipky na krajích zešednou — bez React stavu, posun stránky nepřekresluje
    const kraje = () => {
      const max = el.scrollWidth - el.clientWidth - 2;
      if (zpet.current) zpet.current.disabled = el.scrollLeft <= 2;
      if (dal.current) dal.current.disabled = el.scrollLeft >= max;
    };
    kraje();
    el.addEventListener("scroll", kraje, { passive: true });

    /* Tah myší. Prst a trackpad posouvají pás nativně; myš ne, tak se posun
       dělá ručně. Během tahu je snap vypnutý, jinak by pás cukal k fotkám. */
    let tah: { x: number; left: number; pohnul: boolean } | null = null;
    const dolu = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      tah = { x: e.clientX, left: el.scrollLeft, pohnul: false };
    };
    const pohyb = (e: PointerEvent) => {
      if (!tah) return;
      const dx = e.clientX - tah.x;
      if (!tah.pohnul && Math.abs(dx) > 4) {
        tah.pohnul = true;
        el.dataset.tah = "true";
        el.setPointerCapture(e.pointerId);
      }
      if (tah.pohnul) el.scrollLeft = tah.left - dx;
    };
    const nahoru = () => {
      tah = null;
      delete el.dataset.tah;
    };
    el.addEventListener("pointerdown", dolu);
    el.addEventListener("pointermove", pohyb);
    el.addEventListener("pointerup", nahoru);
    el.addEventListener("pointercancel", nahoru);
    return () => {
      el.removeEventListener("scroll", kraje);
      el.removeEventListener("pointerdown", dolu);
      el.removeEventListener("pointermove", pohyb);
      el.removeEventListener("pointerup", nahoru);
      el.removeEventListener("pointercancel", nahoru);
    };
  }, []);

  const posun = (smer: 1 | -1) => {
    const el = pas.current;
    if (!el) return;
    const fotka = el.querySelector("li");
    const krok = fotka ? fotka.getBoundingClientRect().width * 2 : el.clientWidth / 2;
    const plynule = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: smer * krok, behavior: plynule ? "smooth" : "auto" });
  };

  return (
    <div className={`${s.obal} ${rukopis.variable}`}>
      <div
        ref={pas}
        className={s.pas}
        role="group"
        aria-roledescription="galerie"
        aria-label="Fotky z našeho příběhu"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); posun(1); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); posun(-1); }
        }}
      >
        <div className={s.snura}>
          <ol className={s.fotky}>
            {fotky.map((f, i) => {
              const k = vis(i);
              return (
                <li
                  key={f.src}
                  className={s.bod}
                  style={{ "--k": k.toFixed(3), "--rot": `${NATOCENI[i % NATOCENI.length]}deg` } as React.CSSProperties}
                >
                  {/* úsek provázku k další fotce; u krajních i volný konec ke kraji pásu */}
                  {i < pocet - 1 && <Usek od={k} k={vis(i + 1)} className={s.usek} />}
                  {i === 0 && <Usek od={0} k={k} className={`${s.usek} ${s.konecL}`} />}
                  {i === pocet - 1 && <Usek od={k} k={0} className={`${s.usek} ${s.konecP}`} />}
                  <figure className={s.zaves}>
                    <span className={s.kolicek} aria-hidden="true" />
                    <span className={s.ram}>
                      <img loading="lazy" decoding="async" draggable={false} src={f.src} alt={f.popis} />
                    </span>
                    <figcaption className={s.popis}>{f.popis}</figcaption>
                  </figure>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className={s.ovladani}>
        <button ref={zpet} type="button" className={s.sipka} onClick={() => posun(-1)} aria-label="Předchozí fotky">‹</button>
        <span className={s.napoveda} aria-hidden="true">táhněte do strany</span>
        <button ref={dal} type="button" className={s.sipka} onClick={() => posun(1)} aria-label="Další fotky">›</button>
      </div>

      <div className={s.dopis}>
        <p className={s.osloveni}>Milí hosté,</p>
        <div className={s.text}>{children}</div>
        <p className={s.podpis}>Káťa &amp; Kuba</p>
      </div>
    </div>
  );
}
