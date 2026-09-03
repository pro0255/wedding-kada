"use client";

import { useEffect, useRef, useState } from "react";
import { deviceId } from "@/lib/deviceId";
import type { HraSlug } from "@/lib/hra";
import { HRY_REGISTR } from "./hry";
import type { Barvy, Vstup } from "./hry/typy";
import { Zvuky } from "./zvuk";
import Jmeno from "./Jmeno";
import { Konfety } from "./konfety";
import { sdilejSkore, type VysledekSdileni } from "./sdileni";
import { IKONY } from "./IkonaHry";
import s from "./hra.module.css";

type Faze = "start" | "hra" | "konec";

/** Plátno + smyčka pro libovolnou hru z registru. Plátno vyplní svůj obal
    (na telefonu celou obrazovku, na výšku i na šířku); při změně rozměru se
    hra nastartuje znovu. Hra sama je čistý modul. */
export default function Hra({
  hra,
  onKonec,
  onJmeno,
}: {
  hra: HraSlug;
  onKonec?: (skore: number) => void;
  onJmeno?: (jmeno: string) => void;
}) {
  const def = HRY_REGISTR[hra];
  const obalRef = useRef<HTMLDivElement>(null);
  const platnoRef = useRef<HTMLCanvasElement>(null);
  const skoreRef = useRef<HTMLElement>(null);
  const rekordRef = useRef<HTMLElement>(null);
  const onKonecRef = useRef(onKonec);
  onKonecRef.current = onKonec;
  const zvukyRef = useRef<Zvuky | null>(null);
  const znovuRef = useRef<() => void>(() => {});
  const [faze, setFaze] = useState<Faze>("start");
  const [vysledek, setVysledek] = useState({ skore: 0, novy: false });
  const [dotyk, setDotyk] = useState(false);
  const [ticho, setTicho] = useState(false);
  const [jmenoOtevrene, setJmenoOtevrene] = useState(false);
  const [sdileni, setSdileni] = useState<"klid" | "pracuji" | VysledekSdileni>("klid");
  const [vyzva, setVyzva] = useState<{ od: string; skore: number } | null>(null);
  const barvyRef = useRef({ ink: "#2b2925", inkJemny: "#635d55", zlata: "#9a8158", pozadi: "#ece7de", bg: "#f5f2ec" });

  useEffect(() => {
    setDotyk(matchMedia("(pointer: coarse)").matches);
    const zvuky = new Zvuky();
    zvukyRef.current = zvuky;
    setTicho(zvuky.ztlumeno);

    const obal = obalRef.current;
    const platno = platnoRef.current;
    const ctx2d = platno?.getContext("2d");
    if (!obal || !platno || !ctx2d) return;
    const ctx: CanvasRenderingContext2D = ctx2d;
    const css = getComputedStyle(document.documentElement);
    const barvy: Barvy = {
      ink: css.getPropertyValue("--ink").trim() || "#2b2925",
      inkJemny: css.getPropertyValue("--ink-soft").trim() || "#635d55",
      zlata: css.getPropertyValue("--accent").trim() || "#9a8158",
      pozadi: css.getPropertyValue("--bg-alt").trim() || "#ece7de",
    };
    barvyRef.current = { ...barvy, bg: css.getPropertyValue("--bg").trim() || "#f5f2ec" };
    const konfety = new Konfety();

    // výzva z odkazu: /hry/<hra>?od=Karel&skore=131
    const q = new URLSearchParams(window.location.search);
    const od = q.get("od");
    const vyzvaSkore = Number(q.get("skore"));
    if (od && Number.isInteger(vyzvaSkore) && vyzvaSkore > 0 && od.length <= 30) {
      setVyzva({ od, skore: vyzvaSkore });
    }
    const KLIC = `kj-${def.slug}-rekord`;
    let rekord = 0;
    try {
      rekord = Number(localStorage.getItem(KLIC)) || 0;
    } catch {}
    if (rekordRef.current) rekordRef.current.textContent = String(rekord);

    let W = 0;
    let H = 0;
    let stav = def.start({ W: 1, H: 1 });
    let fazeHry: Faze = "start";
    let casKonce = 0;
    let cas = 0;
    let skore = 0;

    function nastavRozmer() {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      W = Math.max(1, Math.round(obal!.clientWidth));
      H = Math.max(1, Math.round(obal!.clientHeight));
      platno!.width = W * dpr;
      platno!.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      // pozice ve stavu jsou v px — po otočení telefonu začínáme znovu
      stav = def.start({ W, H });
      skore = 0;
      if (skoreRef.current) skoreRef.current.textContent = "0";
      if (fazeHry === "hra") {
        fazeHry = "start";
        setFaze("start");
      }
    }
    nastavRozmer();
    const ro = new ResizeObserver(() => {
      if (Math.abs(obal.clientWidth - W) > 2 || Math.abs(obal.clientHeight - H) > 2) nastavRozmer();
    });
    ro.observe(obal);

    function konec() {
      fazeHry = "konec";
      casKonce = performance.now();
      const novy = skore > rekord && skore > 0;
      if (novy) {
        konfety.spust({ W, H });
        zvuky.prehraj("rekord");
        rekord = skore;
        try {
          localStorage.setItem(KLIC, String(rekord));
        } catch {}
        if (rekordRef.current) rekordRef.current.textContent = String(rekord);
      }
      setVysledek({ skore, novy });
      setJmenoOtevrene(false);
      setSdileni("klid");
      setFaze("konec");
      fetch("/api/hra", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hra: def.slug, deviceId: deviceId(), skore }),
      })
        .catch(() => {})
        .finally(() => onKonecRef.current?.(skore));
    }

    function znovu(v: Vstup = { typ: "tap" }) {
      stav = def.start({ W, H });
      skore = 0;
      if (skoreRef.current) skoreRef.current.textContent = "0";
      fazeHry = "hra";
      setFaze("hra");
      def.vstup(stav, v);
    }
    znovuRef.current = () => {
      zvuky.odemkni();
      znovu();
    };

    function posli(v: Vstup) {
      if (fazeHry === "start") {
        fazeHry = "hra";
        setFaze("hra");
        def.vstup(stav, v);
      } else if (fazeHry === "hra") {
        def.vstup(stav, v);
      } else if (v.typ === "tap" && performance.now() - casKonce > 450) {
        znovu(v);
      }
    }
    function logX(e: PointerEvent) {
      const r = platno!.getBoundingClientRect();
      return ((e.clientX - r.left) / r.width) * W;
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
      if (konfety.aktivni) {
        konfety.krok(dt, { W, H });
        konfety.vykresli(ctx, barvy.ink, barvy.zlata);
      }
      raf = requestAnimationFrame(smycka);
    }
    raf = requestAnimationFrame(smycka);

    // Když host píše jméno (nebo je na tlačítku), klávesy patří jemu, ne hře.
    const vPoli = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      return (
        !!t &&
        (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "BUTTON" || t.isContentEditable)
      );
    };
    const naKlavesu = (e: KeyboardEvent) => {
      if (vPoli(e)) return;
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
      if (vPoli(e)) return;
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
      ro.disconnect();
      window.removeEventListener("keydown", naKlavesu);
      window.removeEventListener("keyup", naPusteni);
      platno.removeEventListener("pointerdown", naDolu);
      platno.removeEventListener("pointermove", naPohyb);
    };
  }, [def]);

  async function sdilej() {
    setSdileni("pracuji");
    let jmeno = "";
    try {
      jmeno = localStorage.getItem("kj-jmeno") ?? "";
    } catch {}
    const url = new URL(`/hry/${def.slug}`, window.location.origin);
    url.searchParams.set("od", jmeno || "Někdo ze svatby");
    url.searchParams.set("skore", String(vysledek.skore));
    const v = await sdilejSkore({
      nazev: def.nazev,
      jmeno: jmeno || "Někdo ze svatby",
      skore: vysledek.skore,
      jednotka: def.jednotka,
      url: url.toString(),
      sprite: IKONY[def.slug],
      barvy: barvyRef.current,
    });
    setSdileni(v);
  }

  const napoveda = dotyk ? def.napoveda.dotyk : def.napoveda.mys;
  return (
    <div className={s.hriste} ref={obalRef}>
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
          <p>{def.popis}</p>
          {vyzva && (
            <p className={s.vyzva}>
              <strong>{vyzva.od}</strong> tě vyzývá: {vyzva.skore} {def.jednotka}. Překonáš to?
            </p>
          )}
          <p className={s.napoveda}>{napoveda}</p>
        </div>
      )}
      {faze === "konec" && (
        <div className={s.zprava} role="status">
          <div className={s.panel}>
            <h2 className="serif">{vysledek.novy ? "Nový rekord!" : "Konec hry"}</h2>
            <p className={s.vysledek}>
              <strong>{vysledek.skore}</strong> {def.jednotka}
            </p>
            {vyzva && (
              <p className={s.vyzvaVysledek}>
                {vysledek.skore > vyzva.skore
                  ? `Překonal(a) jsi ${vyzva.od}!`
                  : `${vyzva.od} má ${vyzva.skore}. Ještě jednou?`}
              </p>
            )}
            {jmenoOtevrene ? (
              <Jmeno
                kompaktni
                onZmena={(j) => {
                  setJmenoOtevrene(false);
                  onJmeno?.(j);
                }}
              />
            ) : (
              <div className={s.akce}>
                <button type="button" className={s.primarni} onClick={() => znovuRef.current()}>
                  Hrát znovu
                </button>
                <button type="button" className={s.sekundarni} onClick={() => setJmenoOtevrene(true)}>
                  Uložit jméno
                </button>
                <button
                  type="button"
                  className={s.sekundarni}
                  disabled={sdileni === "pracuji" || vysledek.skore === 0}
                  onClick={sdilej}
                >
                  {sdileni === "pracuji" ? "Připravuji…" : "Sdílet"}
                </button>
              </div>
            )}
            {sdileni === "otevreno" && (
              <p className={s.poznamka}>Obrázek se otevřel v novém okně, odkaz je ve schránce.</p>
            )}
            {sdileni === "chyba" && <p className={s.poznamka}>Sdílení se nepovedlo.</p>}
            <a href="#zebricek" className={s.odkazDolu}>
              Žebříček ↓
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
