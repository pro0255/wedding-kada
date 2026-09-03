"use client";

import { useEffect, useRef, useState } from "react";
import { deviceId } from "@/lib/deviceId";
import type { HraSlug } from "@/lib/hra";
import { HRY_REGISTR } from "./hry";
import type { Barvy, Vstup } from "./hry/typy";
import { Zvuky } from "./zvuk";
import s from "./hra.module.css";

type Faze = "start" | "hra" | "konec";

/** Plátno + smyčka pro libovolnou hru z registru. Hra sama je čistý modul. */
export default function Hra({
  hra,
  onKonec,
}: {
  hra: HraSlug;
  onKonec?: (skore: number) => void;
}) {
  const def = HRY_REGISTR[hra];
  const platnoRef = useRef<HTMLCanvasElement>(null);
  const skoreRef = useRef<HTMLElement>(null);
  const rekordRef = useRef<HTMLElement>(null);
  const onKonecRef = useRef(onKonec);
  onKonecRef.current = onKonec;
  const zvukyRef = useRef<Zvuky | null>(null);
  const [faze, setFaze] = useState<Faze>("start");
  const [vysledek, setVysledek] = useState({ skore: 0, novy: false });
  const [dotyk, setDotyk] = useState(false);
  const [ticho, setTicho] = useState(false);

  useEffect(() => {
    setDotyk(matchMedia("(pointer: coarse)").matches);
    const zvuky = new Zvuky();
    zvukyRef.current = zvuky;
    setTicho(zvuky.ztlumeno);

    const platno = platnoRef.current;
    const ctx2d = platno?.getContext("2d");
    if (!platno || !ctx2d) return;
    const ctx: CanvasRenderingContext2D = ctx2d;
    const css = getComputedStyle(document.documentElement);
    const barvy: Barvy = {
      ink: css.getPropertyValue("--ink").trim() || "#2b2925",
      inkJemny: css.getPropertyValue("--ink-soft").trim() || "#635d55",
      zlata: css.getPropertyValue("--accent").trim() || "#9a8158",
      pozadi: css.getPropertyValue("--bg-alt").trim() || "#ece7de",
    };
    const KLIC = `kj-${def.slug}-rekord`;
    let rekord = 0;
    try {
      rekord = Number(localStorage.getItem(KLIC)) || 0;
    } catch {}
    if (rekordRef.current) rekordRef.current.textContent = String(rekord);

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    platno.width = def.W * dpr;
    platno.height = def.H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    let stav = def.start();
    let fazeHry: Faze = "start";
    let casKonce = 0;
    let cas = 0;
    let skore = 0;

    function konec() {
      fazeHry = "konec";
      casKonce = performance.now();
      const novy = skore > rekord;
      if (novy) {
        rekord = skore;
        try {
          localStorage.setItem(KLIC, String(rekord));
        } catch {}
        if (rekordRef.current) rekordRef.current.textContent = String(rekord);
      }
      setVysledek({ skore, novy });
      setFaze("konec");
      fetch("/api/hra", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hra: def.slug, deviceId: deviceId(), skore }),
      })
        .catch(() => {})
        .finally(() => onKonecRef.current?.(skore));
    }

    function posli(v: Vstup) {
      if (fazeHry === "start") {
        fazeHry = "hra";
        setFaze("hra");
        def.vstup(stav, v);
      } else if (fazeHry === "hra") {
        def.vstup(stav, v);
      } else if (v.typ === "tap" && performance.now() - casKonce > 450) {
        stav = def.start();
        skore = 0;
        if (skoreRef.current) skoreRef.current.textContent = "0";
        fazeHry = "hra";
        setFaze("hra");
        def.vstup(stav, v);
      }
    }
    function logX(e: PointerEvent) {
      const r = platno!.getBoundingClientRect();
      return ((e.clientX - r.left) / r.width) * def.W;
    }

    let posledni = performance.now();
    let raf = 0;
    function smycka(t: number) {
      const dt = Math.min(0.05, (t - posledni) / 1000);
      posledni = t;
      cas += dt;
      if (fazeHry === "hra") {
        const k = def.krok(stav, dt);
        skore = k.skore;
        if (skoreRef.current) skoreRef.current.textContent = String(skore);
        k.zvuky?.forEach((z) => zvuky.prehraj(z));
        if (k.konec) konec();
      }
      def.vykresli(ctx, stav, barvy, cas, fazeHry === "hra");
      raf = requestAnimationFrame(smycka);
    }
    raf = requestAnimationFrame(smycka);

    const naKlavesu = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        zvuky.odemkni();
        if (!e.repeat) posli({ typ: "tap" });
      } else if (e.code === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        zvuky.odemkni();
        posli({ typ: "klavesa", smer: -1 });
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        zvuky.odemkni();
        posli({ typ: "klavesa", smer: 1 });
      }
    };
    const naPusteni = (e: KeyboardEvent) => {
      if (["ArrowLeft", "KeyA", "ArrowRight", "KeyD"].includes(e.code)) {
        posli({ typ: "klavesa", smer: 0 });
      }
    };
    const naDolu = (e: PointerEvent) => {
      e.preventDefault();
      platno.focus({ preventScroll: true });
      zvuky.odemkni();
      posli({ typ: "tap" });
      posli({ typ: "pohyb", x: logX(e) });
    };
    const naPohyb = (e: PointerEvent) => {
      if (e.pressure > 0 || e.buttons) posli({ typ: "pohyb", x: logX(e) });
    };
    window.addEventListener("keydown", naKlavesu);
    window.addEventListener("keyup", naPusteni);
    platno.addEventListener("pointerdown", naDolu);
    platno.addEventListener("pointermove", naPohyb);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", naKlavesu);
      window.removeEventListener("keyup", naPusteni);
      platno.removeEventListener("pointerdown", naDolu);
      platno.removeEventListener("pointermove", naPohyb);
    };
  }, [def]);

  const napoveda = dotyk ? def.napoveda.dotyk : def.napoveda.mys;
  return (
    <div className={s.hriste} style={{ aspectRatio: `${def.W} / ${def.H}` }}>
      <canvas
        ref={platnoRef}
        className={s.platno}
        tabIndex={0}
        role="img"
        aria-label={`Hra ${def.nazev}. ${napoveda}.`}
      />
      <div className={s.hud}>
        <span>
          <strong ref={skoreRef}>0</strong> {def.jednotka}
        </span>
        <span>
          rekord <strong ref={rekordRef}>0</strong>
        </span>
        <button
          type="button"
          className={s.zvuk}
          aria-pressed={ticho}
          aria-label={ticho ? "Zapnout zvuk" : "Ztlumit zvuk"}
          title={ticho ? "Zapnout zvuk" : "Ztlumit zvuk"}
          onClick={() => {
            const z = zvukyRef.current;
            if (!z) return;
            setTicho(z.prepni());
            z.odemkni();
          }}
        >
          {ticho ? "♪̸" : "♪"}
        </button>
      </div>
      {faze === "start" && (
        <div className={s.zprava}>
          <h2 className="serif">{def.nazev}</h2>
          <p>{napoveda}</p>
        </div>
      )}
      {faze === "konec" && (
        <div className={s.zprava} role="status">
          <h2 className="serif">{vysledek.novy ? "Nový rekord!" : "Konec hry"}</h2>
          <p>
            {vysledek.skore} {def.jednotka} · znovu {dotyk ? "klepnutím" : "mezerníkem"}
          </p>
        </div>
      )}
    </div>
  );
}
