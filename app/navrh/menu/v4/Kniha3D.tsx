"use client";

import { startTransition, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ALERGENY, DETI, DOSPELI, UVOD } from "../obsah";
import Kniha from "../v1/Kniha";
import type { Scena } from "./scena";
import s from "./kniha3d.module.css";

/* Návrh 4 — kniha z návrhu 1 jako opravdový 3D objekt (WebGL, three.js).

   Tahle komponenta je jen obal: three.js a GSAP se stáhnou až ve chvíli,
   kdy se sekce blíží k obrazovce (IntersectionObserver), a scéna přestane
   kreslit, když z obrazovky odjede. Bez WebGL (nebo když se scéna nepovede
   postavit) se ukáže DOM kniha z návrhu 1.

   Plátno je pro čtečky neviditelné; obsah menu je pod ním jako skrytý text
   a ovládá se skutečnými tlačítky (aria-expanded). */

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

function maWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

type Rezim = "cekam" | "nacitam" | "3d" | "zaloha";

export default function Kniha3D() {
  const [rezim, setRezim] = useState<Rezim>("cekam");
  const [otevrene, setOtevrene] = useState(false);
  const [strana, setStrana] = useState(0);
  const telefon = useTelefon();
  const kontejner = useRef<HTMLDivElement>(null);
  const scena = useRef<Scena | null>(null);
  const tah = useRef<{ x: number; y: number; swipe: boolean } | null>(null);

  useEffect(() => {
    const el = kontejner.current;
    if (!el) return;
    if (!maWebGL()) {
      setRezim("zaloha");
      return;
    }
    const ac = new AbortController();
    let hlidac: IntersectionObserver | undefined;
    const priblizeni = new IntersectionObserver(
      (zaznamy) => {
        if (!zaznamy.some((z) => z.isIntersecting)) return;
        priblizeni.disconnect();
        setRezim("nacitam");
        const klid = matchMedia("(prefers-reduced-motion: reduce)").matches;
        import("./scena")
          .then((m) => m.vytvorScenu(el, { klid, signal: ac.signal }))
          .then((sc) => {
            scena.current = sc;
            setRezim("3d");
            // Mimo obrazovku se nekreslí.
            hlidac = new IntersectionObserver((z) => sc.viditelnost(z.some((x) => x.isIntersecting)));
            hlidac.observe(el);
          })
          .catch((chyba: unknown) => {
            if (ac.signal.aborted) return;
            console.warn("Menu 3D: přepínám na DOM knihu", chyba);
            setRezim("zaloha");
          });
      },
      { rootMargin: "400px 0px" },
    );
    priblizeni.observe(el);
    return () => {
      ac.abort();
      priblizeni.disconnect();
      hlidac?.disconnect();
      scena.current?.dispose();
      scena.current = null;
    };
  }, []);

  // Scéna dostane povel hned, tlačítka a skrytý text se přepnou v přechodu.
  const cil = useRef(false);
  function prepni() {
    const nove = !cil.current;
    cil.current = nove;
    scena.current?.otevri(nove);
    startTransition(() => {
      setOtevrene(nove);
      if (!nove) setStrana(0);
    });
  }

  function naStranu(i: number) {
    scena.current?.strana(i);
    startTransition(() => setStrana(i));
  }

  if (rezim === "zaloha") return <Kniha />;

  return (
    <div className={s.obal}>
      <div ref={kontejner} className={s.scena3d}>
        {rezim !== "3d" && (
          <p className={s.nacitam} aria-live="polite">
            Připravuji menu…
          </p>
        )}
        {/* Přepínač stran leží přes spodek plátna a je tam pořád, jen
            neviditelný — při otevření se tak nic nepřeskládá (žádný layout
            uprostřed animace). */}
        {rezim === "3d" && telefon && (
          <div
            className={s.prepinac + (otevrene ? " " + s.prepinacVidet : "")}
            role="group"
            aria-label="Strana menu"
            inert={!otevrene}
          >
            <button type="button" aria-pressed={strana === 0} onClick={() => naStranu(0)}>
              Menu
            </button>
            <button type="button" aria-pressed={strana === 1} onClick={() => naStranu(1)}>
              Pro děti
            </button>
          </div>
        )}
        {rezim === "3d" && (
          <button
            type="button"
            className={s.dotyk}
            aria-expanded={otevrene}
            aria-controls="menu-v4-text"
            aria-label={otevrene ? "Zavřít svatební menu" : "Otevřít svatební menu"}
            onPointerDown={(e) => {
              tah.current = { x: e.clientX, y: e.clientY, swipe: false };
              scena.current?.predehra();
            }}
            onKeyDown={() => scena.current?.predehra()}
            onPointerUp={(e) => {
              const t = tah.current;
              if (!t) return;
              const dx = e.clientX - t.x;
              const dy = e.clientY - t.y;
              // Vodorovné táhnutí na telefonu listuje, neklikne.
              if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) {
                t.swipe = true;
                if (cil.current && telefon) naStranu(dx < 0 ? 1 : 0);
              }
            }}
            onClick={() => {
              const swipe = tah.current?.swipe;
              tah.current = null;
              if (!swipe) prepni();
            }}
          />
        )}
      </div>

      {/* Obsah menu pro čtečky obrazovky — vizuálně je v plátně. */}
      {/* visibility místo hidden: skrytí nemění rozložení stránky. */}
      <div id="menu-v4-text" className={s.ctecky} style={{ visibility: otevrene ? "visible" : "hidden" }}>
        <h3>Menu</h3>
        <p>{UVOD}</p>
        <ul>
          {DOSPELI.map((c) => (
            <li key={c.kurz}>
              {c.kurz}: {c.jidlo} ({c.detail})
            </li>
          ))}
        </ul>
        <p>{ALERGENY}</p>
        <h3>Pro naše nejmenší</h3>
        <ul>
          {DETI.map((c) => (
            <li key={c.kurz}>
              {c.kurz}: {c.jidlo} ({c.detail})
            </li>
          ))}
        </ul>
        <p>Dobrou chuť</p>
      </div>

      <div className={s.ovladani}>
        <button
          type="button"
          className={s.tlacitko}
          onPointerDown={() => scena.current?.predehra()}
          onKeyDown={() => scena.current?.predehra()}
          onClick={prepni}
          aria-expanded={otevrene}
          aria-controls="menu-v4-text"
          disabled={rezim !== "3d"}
        >
          {otevrene ? "Zavřít menu" : "Otevřít menu"}
        </button>
      </div>
    </div>
  );
}
