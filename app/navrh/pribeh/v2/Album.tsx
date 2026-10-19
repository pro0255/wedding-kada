"use client";

import { startTransition, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Sacramento } from "next/font/google";
import { DOPIS, FOTKY } from "../data";
import s from "./album.module.css";

/* Fotoalbum: rozevřená dvoustrana v plátěných deskách, fotky přichycené
   rožky, dopis na první straně. Listuje se jako v knize.

   Na počítači leží vlevo i vpravo pevná strana (dopis a závěr) a mezi nimi
   čtyři listy přichycené ve hřbetu. Každý list má líc (pravá strana) a rub
   (levá strana další dvoustrany) a přetáčí se rotateY kolem hřbetu — jen
   transform, rub je otočený o 180° a skrytý backface-visibility. Otáčející
   se list jde po dobu otočky navrch (data-otaci), jinak by ho sousední listy
   zakryly.

   Na telefonu se dvoustrana nevejde: strany leží na sobě a odlistovaná strana
   se otočí přes levý okraj pryč. Obě podoby kreslí tytéž strany (strana()),
   jen jinak poskládané.

   Popisky jsou v Sacramento — tenké pero, jako když se do alba píše
   plnicím perem; s latin-ext, tedy s háčky a čárkami. */

const pero = Sacramento({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  variable: "--s2-pero",
  preload: false,
});

// rozvržení stran s fotkami: indexy do FOTKY a jak leží
type Rozvrh = { fotky: number[]; tvar: "nasirku" | "navysku" | "jedna" };
const STRANY_FOTEK: Rozvrh[] = [
  { fotky: [0, 1], tvar: "nasirku" },
  { fotky: [2, 3], tvar: "nasirku" },
  { fotky: [4, 5], tvar: "nasirku" },
  { fotky: [6, 7], tvar: "navysku" },
  { fotky: [8, 9], tvar: "navysku" },
  { fotky: [10, 11], tvar: "navysku" },
  { fotky: [12, 13], tvar: "navysku" },
  { fotky: [14], tvar: "jedna" },
];
// strana 0 = dopis, 1–8 fotky, 9 = závěr
const POCET_STRAN = STRANY_FOTEK.length + 2;
// na počítači: dvoustrany 0|1, 2|3 … 8|9 → listy nesou strany 1–8
const LISTU = STRANY_FOTEK.length / 2;
const DVOUSTRAN = LISTU + 1;
// lehké natočení fotek, ať nestojí jak v katalogu
const NATOCENI = [-2.2, 1.6, 1.2, -1.8, -1, 2];
const OTOCKA_MS = 950;

function Fotka({ i, poradi, tvar }: { i: number; poradi: number; tvar: Rozvrh["tvar"] }) {
  const f = FOTKY[i];
  return (
    <figure
      className={`${s.fotka} ${s[tvar]}`}
      style={{ "--rot": `${NATOCENI[(i + poradi) % NATOCENI.length]}deg` } as React.CSSProperties}
    >
      <span className={s.snimek}>
        <img loading="lazy" decoding="async" draggable={false} src={f.src} alt={f.popis} />
        <span className={`${s.rozek} ${s.lh}`} aria-hidden="true" />
        <span className={`${s.rozek} ${s.ph}`} aria-hidden="true" />
        <span className={`${s.rozek} ${s.ld}`} aria-hidden="true" />
        <span className={`${s.rozek} ${s.pd}`} aria-hidden="true" />
      </span>
      <figcaption className={s.popis}>{f.popis}</figcaption>
    </figure>
  );
}

// obsah strany n (bez papíru kolem)
function Obsah({ n }: { n: number }) {
  if (n === 0) {
    return (
      <div className={s.dopis}>
        <p className={s.osloveni}>Milí hosté,</p>
        <p className={s.text}>{DOPIS}</p>
        <p className={s.podpis}>Káťa &amp; Kuba</p>
      </div>
    );
  }
  if (n === POCET_STRAN - 1) {
    return (
      <div className={s.zaver}>
        <p className={s.pokracovani}>Pokračování příště…</p>
        <p className={s.datum}>18. září 2027 · u zvoničky v Rekovicích</p>
      </div>
    );
  }
  const r = STRANY_FOTEK[n - 1];
  return (
    <div className={`${s.fotky} ${s["sada_" + r.tvar]}`}>
      {r.fotky.map((i, poradi) => (
        <Fotka key={i} i={i} poradi={poradi} tvar={r.tvar} />
      ))}
    </div>
  );
}

const uzkyDotaz = "(max-width: 760px)";
const odebirej = (zmena: () => void) => {
  const m = window.matchMedia(uzkyDotaz);
  m.addEventListener("change", zmena);
  return () => m.removeEventListener("change", zmena);
};

export default function Album() {
  const uzky = useSyncExternalStore(odebirej, () => window.matchMedia(uzkyDotaz).matches, () => false);
  // na počítači číslo dvoustrany, na telefonu číslo strany
  const [poloha, setPoloha] = useState(0);
  const [otaci, setOtaci] = useState<number | null>(null);
  const casovac = useRef<number | undefined>(undefined);
  const tah = useRef<{ x: number; y: number } | null>(null);
  const tahlo = useRef(false);

  const max = uzky ? POCET_STRAN - 1 : DVOUSTRAN - 1;
  // při přepnutí mezi telefonem a počítačem začít od začátku
  useEffect(() => setPoloha(0), [uzky]);
  useEffect(() => () => window.clearTimeout(casovac.current), []);

  const jdi = (smer: 1 | -1) => {
    const cil = poloha + smer;
    if (cil < 0 || cil > max) return;
    // list, který se teď otáčí: vpřed ten na pravé straně, zpět ten vlevo
    const list = smer === 1 ? poloha : cil;
    window.clearTimeout(casovac.current);
    startTransition(() => {
      setOtaci(list);
      setPoloha(cil);
    });
    casovac.current = window.setTimeout(() => setOtaci(null), OTOCKA_MS);
  };

  const listy = uzky
    ? Array.from({ length: POCET_STRAN }, (_, i) => ({ lic: i, rub: -1 }))
    : Array.from({ length: LISTU }, (_, k) => ({ lic: 2 * k + 1, rub: 2 * k + 2 }));
  const pocetListu = listy.length;

  return (
    <div className={`${s.obal} ${pero.variable}`}>
      <div className={s.hlavicka}>
        <p className="eyebrow">Náš příběh</p>
        <h2>Jak to celé začalo</h2>
      </div>

      <div
        className={`${s.desky} ${uzky ? s.uzke : ""}`}
        role="group"
        aria-roledescription="fotoalbum"
        aria-label="Naše fotoalbum"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); jdi(1); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); jdi(-1); }
        }}
      >
        <div
          className={s.blok}
          onPointerDown={(e) => { tah.current = { x: e.clientX, y: e.clientY }; tahlo.current = false; }}
          onPointerUp={(e) => {
            const z = tah.current;
            tah.current = null;
            if (!z) return;
            const dx = e.clientX - z.x;
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - z.y)) {
              tahlo.current = true;
              jdi(dx < 0 ? 1 : -1);
            }
          }}
          onPointerCancel={() => (tah.current = null)}
          onClick={(e) => {
            if (tahlo.current) { tahlo.current = false; return; }
            const r = e.currentTarget.getBoundingClientRect();
            // na telefonu: levá třetina zpět; na počítači: levá strana zpět
            const hranice = uzky ? r.width * 0.33 : r.width / 2;
            jdi(e.clientX - r.left < hranice ? -1 : 1);
          }}
        >
          {!uzky && (
            <>
              <div className={`${s.strana} ${s.leva} ${s.pevna}`}><Obsah n={0} /></div>
              <div className={`${s.strana} ${s.prava} ${s.pevna}`}><Obsah n={POCET_STRAN - 1} /></div>
            </>
          )}
          {listy.map((l, k) => {
            const otoceny = k < poloha;
            const z = otaci === k ? 50 : otoceny ? k + 1 : pocetListu - k + 1;
            return (
              <div
                key={k}
                className={s.list}
                data-otoceny={otoceny}
                style={{ zIndex: z }}
                aria-hidden={uzky ? k !== poloha : !(k === poloha || k === poloha - 1)}
              >
                <div className={`${s.strana} ${s.prava} ${s.lic}`}><Obsah n={l.lic} /></div>
                {l.rub >= 0 && <div className={`${s.strana} ${s.leva} ${s.rub}`}><Obsah n={l.rub} /></div>}
              </div>
            );
          })}
          {!uzky && <span className={s.hrbet} aria-hidden="true" />}
        </div>
      </div>

      <div className={s.ovladani}>
        <button type="button" className={s.sipka} onClick={() => jdi(-1)} disabled={poloha === 0} aria-label="Předchozí strana">‹</button>
        <span className={s.pocet} aria-live="polite">
          <span className="jen-pro-odecitace">{uzky ? "Strana " : "Dvoustrana "}</span>
          {poloha + 1}
          <span aria-hidden="true"> / </span>
          <span className="jen-pro-odecitace"> z </span>
          {max + 1}
        </span>
        <button type="button" className={s.sipka} onClick={() => jdi(1)} disabled={poloha === max} aria-label="Další strana">›</button>
      </div>
    </div>
  );
}
