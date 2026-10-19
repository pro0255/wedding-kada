"use client";

/* Příběh jako časopisecká dvoustrana v kapitolách. Dopis je rozdělený na
   šest úryvků, ke každému patří fotky z té doby (fotky jsou seřazené
   chronologicky, takže se kapitoly berou po sobě). Výměna kapitoly je jen
   prolnutí — nový obsah dostane nový klíč a CSS animace ho uvede (opacity
   a posun, nic jiného). Přepnutí běží v přechodu (startTransition), první
   snímek po klepnutí tak nečeká na překreslení. */

import { startTransition, useEffect, useRef, useState } from "react";
import { FOTKY } from "../data";
import s from "./kapitoly.module.css";

const F = (popis: string) => {
  const f = FOTKY.find((x) => x.popis === popis);
  if (!f) throw new Error(`fotka „${popis}“ v data.ts není`);
  return f;
};

/* Úryvky jsou doslova z dopisu; trojtečky říkají, že věta pokračuje
   v další kapitole. */
const KAPITOLY = [
  { nazev: "Poznali jsme se", text: "Poznali jsme se…", fotky: [F("První společná fotka"), F("ZOO Ostrava")] },
  { nazev: "Zamilovali se", text: "…zamilovali se…", fotky: [F("Bílovec"), F("Chorvatsko"), F("Kozmice")] },
  { nazev: "Krásné i náročnější chvíle", text: "…prošli spolu krásnými i náročnějšími chvílemi…", fotky: [F("Sicílie"), F("Svatba I & O")] },
  { nazev: "Domov plný smíchu", text: "…a vybudovali domov plný smíchu, lásky a společných vzpomínek.", fotky: [F("Těhotenské focení"), F("První Chorvatsko jako rodina"), F("Slovensko")] },
  { nazev: "Zásnuby na Troskách", text: "Pět let spolu, jedno zásnubní „ano“ na Troskách a teď nás čeká naše největší společné dobrodružství.", fotky: [F("Zásnuby na Troskách"), F("Štramberk"), F("FM City Fest"), F("Trogir")] },
  { nazev: "18. září 2027", text: "Dnes už víme, že chceme jít životem bok po boku — a proto si 18. září 2027 řekneme své „ano“.", fotky: [F("Kutná Hora")] },
];

const cislo = (i: number) => String(i + 1).padStart(2, "0");
const TAH_PX = 40;

export default function Kapitoly() {
  const [k, setK] = useState(0);
  const [hlavni, setHlavni] = useState(0); // která fotka kapitoly je velká
  const tah = useRef<{ x: number; y: number } | null>(null);
  const pocet = KAPITOLY.length;
  const kap = KAPITOLY[k];
  const velka = kap.fotky[hlavni] ?? kap.fotky[0];
  const male = kap.fotky.filter((f) => f !== velka);

  const jdi = (i: number) =>
    startTransition(() => {
      setK((i + pocet) % pocet);
      setHlavni(0);
    });

  // fotky další kapitoly se dekódují dopředu, ať prolnutí nečeká na obrázek
  useEffect(() => {
    const dalsi = KAPITOLY[(k + 1) % pocet];
    const id = window.setTimeout(() => {
      for (const f of dalsi.fotky) {
        const img = new Image();
        img.src = f.src;
        img.decode?.().catch(() => undefined);
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [k, pocet]);

  return (
    <div
      className={s.kapitoly}
      role="group"
      aria-roledescription="kapitoly"
      aria-label="Náš příběh v kapitolách"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); jdi(k + 1); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); jdi(k - 1); }
      }}
    >
      <header className={s.hlavicka}>
        <p className={s.eyebrow}>Náš příběh</p>
        <h2 className={s.nadpis}>Jak to celé začalo</h2>
      </header>

      {/* Obsah: tenká osa s kapitolami. Div s rolí, ne <nav> — globals.css
          skrývá na telefonu každý nav (menu webu). */}
      <div className={s.osa} role="navigation" aria-label="Kapitoly">
        <ol>
          {KAPITOLY.map((x, i) => (
            <li key={x.nazev}>
              <button
                type="button"
                className={s.osaBod}
                aria-current={i === k ? "step" : undefined}
                onClick={() => jdi(i)}
              >
                <span className={s.osaCislo}>{cislo(i)}</span>
                <span className={s.osaNazev}>{x.nazev}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div
        className={s.dvoustrana}
        onPointerDown={(e) => { tah.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={(e) => {
          const z = tah.current;
          tah.current = null;
          if (!z || e.pointerType === "mouse") return;
          const dx = e.clientX - z.x;
          if (Math.abs(dx) > TAH_PX && Math.abs(dx) > Math.abs(e.clientY - z.y)) jdi(dx < 0 ? k + 1 : k - 1);
        }}
        onPointerCancel={() => { tah.current = null; }}
      >
        <div key={`t${k}`} className={s.text}>
          <span className={s.velkeCislo} aria-hidden="true">{cislo(k)}</span>
          <p className={s.kapitolaNazev}>
            <span className="jen-pro-odecitace">Kapitola {k + 1}: </span>
            {kap.nazev}
          </p>
          <p className={s.uryvek}>{kap.text}</p>
        </div>

        <div key={`f${k}`} className={s.fotky}>
          <figure className={s.velka}>
            <img key={velka.src} src={velka.src} alt={velka.popis} loading="lazy" decoding="async" draggable={false} />
            <figcaption>{velka.popis}</figcaption>
          </figure>
          {male.length > 0 && (
            <ul className={s.male}>
              {male.map((f) => (
                <li key={f.src}>
                  <button
                    type="button"
                    onClick={() => startTransition(() => setHlavni(kap.fotky.indexOf(f)))}
                    aria-label={`Zvětšit fotku: ${f.popis}`}
                  >
                    <img src={f.src} alt="" loading="lazy" decoding="async" draggable={false} />
                    <span>{f.popis}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={s.listovani}>
          <button type="button" onClick={() => jdi(k - 1)} aria-label="Předchozí kapitola">←</button>
          <span aria-live="polite">{cislo(k)} <span aria-hidden="true">/</span><span className="jen-pro-odecitace"> z </span> {cislo(pocet - 1)}</span>
          <button type="button" onClick={() => jdi(k + 1)} aria-label="Další kapitola">→</button>
        </div>
      </div>
    </div>
  );
}
