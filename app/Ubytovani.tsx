"use client";

import { useEffect, useRef, useState } from "react";
import { VENUE_WEB_URL } from "./venue";

type Stav = { obsazeno: number; celkem: number; volno: number };


/* Růžové doodle auto, které projede po lince nad ubytováním — vyjede z mlhy
   vlevo a do mlhy vpravo zase zmizí. Kreslí se stejnou rukou jako doodly
   u „Náš příběh“: jen obrys, kulaté konce tahů, žádná výplň.

   Auto míří doprava, přední kapota je tedy na pravé straně. Kola sedí středem
   na spodní hraně karoserie (y = 30) a spodkem přesahují pod ni, takže po
   lince opravdu jedou, ne aby se vznášela.

   Pohyb i mlhu na koncích řídí .auto-drah v globals.css. Animace stojí,
   dokud linka nedojede do viewportu — jinak auto běží na volnoběh od načtení
   stránky a host, který k mapě doscrolluje později, chytne zrovna tu část
   cyklu, kdy je auto pryč, a čeká i patnáct vteřin. */
function AutoDrah({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Sleduje se okolní blok, ne samotná dráha: ta je absolutní a nulově
    // vysoká, a takový cíl IntersectionObserver spolehlivě nehlásí.
    const cil = el.closest(".ubytovani") ?? el;
    const io = new IntersectionObserver(
      (zaznamy) => {
        if (zaznamy.some((z) => z.isIntersecting)) {
          el.classList.add("jede");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(cil);
    return () => io.disconnect();
  }, []);
  return (
    <span ref={ref} className="auto-drah" aria-hidden="true">
      {children}
    </span>
  );
}

function AutoNaLince() {
  const T = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <AutoDrah>
      <svg viewBox="0 0 72 36" focusable="false">
        {/* karoserie jedním tahem: zaoblená záď, střecha, čelní sklo, kapota */}
        <path
          {...T}
          d="M 8 30 C 3 30, 2 23, 6 21 C 9 20, 13 19.4, 17 19 C 21 10, 29 5.5, 39 5.5 C 49 5.5, 56 10, 59.5 18.5 C 63 19, 67 20, 68.5 21 C 72 22.5, 71.5 29, 66 30 Z"
        />
        {/* okna oddělená sloupkem — zadní menší, přední se svažuje s čelním sklem */}
        <path {...T} d="M 20.5 18.5 C 23.5 11.5, 29 7.8, 35.5 7.5 L 35.5 18.5 Z" />
        <path {...T} d="M 39 7.5 C 46.5 7.8, 52.5 11.5, 56 18.5 L 39 18.5 Z" />
        {/* hrana dveří a klika */}
        <path {...T} d="M 37.2 19 L 37.2 28" />
        <path {...T} d="M 30 22.5 L 34.5 22.5" />
        {/* kola s náboji */}
        <circle {...T} cx="21" cy="30" r="4.6" />
        <circle {...T} cx="21" cy="30" r="1.5" />
        <circle {...T} cx="55" cy="30" r="4.6" />
        <circle {...T} cx="55" cy="30" r="1.5" />
      </svg>
    </AutoDrah>
  );
}

export default function Ubytovani() {
  const [stav, setStav] = useState<Stav | null>(null);
  const [jmeno, setJmeno] = useState("");
  const [pocet, setPocet] = useState("1");
  const [web, setWeb] = useState(""); // past na roboty, zůstává prázdné
  const [odesila, setOdesila] = useState(false);
  const [hotovo, setHotovo] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

  // host už jednou rezervoval (přežije obnovení stránky)
  useEffect(() => {
    try {
      if (localStorage.getItem("ubytovani-rezervovano") === "1") setHotovo(true);
    } catch {
      /* soukromé okno apod. — potvrzení se prostě nezapamatuje */
    }
  }, []);

  // načtení aktuální kapacity
  useEffect(() => {
    let zruseno = false;
    fetch("/api/ubytovani")
      .then((r) => r.json())
      .then((data: Stav) => {
        if (!zruseno) setStav(data);
      })
      .catch(() => {
        /* kapacita se prostě nezobrazí */
      });
    return () => {
      zruseno = true;
    };
  }, []);

  async function odesli(e: React.FormEvent) {
    e.preventDefault();
    if (odesila) return;

    setOdesila(true);
    setChyba(null);

    try {
      const odpoved = await fetch("/api/ubytovani", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jmeno, pocet: Number(pocet), web }),
      });
      const data = await odpoved.json();

      if (!odpoved.ok) {
        if (data.stav) setStav(data.stav);
        setChyba(data.chyba ?? "Něco se pokazilo, zkuste to prosím znovu.");
        return;
      }

      setStav(data.stav);
      setHotovo(true);
      setJmeno("");
      setPocet("1");
      try {
        localStorage.setItem("ubytovani-rezervovano", "1");
      } catch {
        /* nevadí */
      }
    } catch {
      setChyba("Odeslání se nezdařilo. Zkontrolujte připojení a zkuste to znovu.");
    } finally {
      setOdesila(false);
    }
  }

  const procenta = stav ? Math.min(100, (stav.obsazeno / stav.celkem) * 100) : 0;
  const plno = stav?.volno === 0;

  return (
    <div className="ubytovani">
      <AutoNaLince />
      <h3>Ubytování</h3>
      <p className="lead">
        Máme pro vás zamluvená lůžka přímo v místě konání —{" "}
        <strong>1&nbsp;150&nbsp;Kč za osobu se snídaní</strong>. Kapacita je
        omezená, místa přidělujeme postupně podle toho, jak se hlásíte. Dejte nám
        vědět, kolik vás přijede.
      </p>
      <p className="ubytovani-hotel">
        <a href={VENUE_WEB_URL} target="_blank" rel="noopener">Web hotelu Rekovice</a>
      </p>

      {stav && (
        <div className="kapacita" aria-live="polite">
          <div className="kapacita-cisla">
            <b>
              {stav.obsazeno}
              <span>/{stav.celkem}</span>
            </b>
            <span className="kapacita-popis">
              {plno ? "kapacita je plná" : `volných míst: ${stav.volno}`}
            </span>
          </div>
          <div className="kapacita-bar">
            <div className="kapacita-fill" style={{ width: `${procenta}%` }} />
          </div>
        </div>
      )}

      {hotovo ? (
        <div className="ubytovani-dekujeme" role="status">
          <p>Děkujeme, máme to zapsané! Ozveme se vám s detaily.</p>
          {!plno && (
            <button
              type="button"
              className="ubytovani-znovu"
              onClick={() => {
                setHotovo(false);
                setChyba(null);
                try {
                  localStorage.removeItem("ubytovani-rezervovano");
                } catch {
                  /* nevadí */
                }
              }}
            >
              Přidat další rezervaci
            </button>
          )}
        </div>
      ) : (
        <form className="ubytovani-form" onSubmit={odesli}>
          <label>
            <span>Jméno a příjmení</span>
            <input
              type="text"
              value={jmeno}
              onChange={(e) => setJmeno(e.target.value)}
              placeholder="Jana Nováková"
              autoComplete="name"
              required
              minLength={3}
              maxLength={80}
              disabled={plno}
            />
          </label>

          <label className="ubytovani-pocet">
            <span>Počet osob</span>
            <input
              type="number"
              value={pocet}
              onChange={(e) => setPocet(e.target.value)}
              min={1}
              max={10}
              required
              disabled={plno}
            />
          </label>

          {/* skryté pole proti spamu — návštěvník ho nevidí */}
          <input
            type="text"
            className="ubytovani-past"
            tabIndex={-1}
            autoComplete="off"
            value={web}
            onChange={(e) => setWeb(e.target.value)}
            aria-hidden="true"
          />

          <button className="btn" type="submit" disabled={odesila || plno}>
            {plno ? "Obsazeno" : odesila ? "Odesílám…" : "Rezervovat"}
          </button>
        </form>
      )}

      {chyba && (
        <p className="ubytovani-chyba" role="alert">
          {chyba}
        </p>
      )}
    </div>
  );
}
