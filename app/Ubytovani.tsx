"use client";

import { useEffect, useState } from "react";

type Stav = { obsazeno: number; celkem: number; volno: number };

export default function Ubytovani() {
  const [stav, setStav] = useState<Stav | null>(null);
  const [jmeno, setJmeno] = useState("");
  const [pocet, setPocet] = useState("1");
  const [web, setWeb] = useState(""); // past na roboty, zůstává prázdné
  const [odesila, setOdesila] = useState(false);
  const [hotovo, setHotovo] = useState(false);
  const [chyba, setChyba] = useState<string | null>(null);

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
      <h3>Ubytování</h3>
      <p className="lead">
        Máme pro vás zamluvená lůžka přímo v místě konání —{" "}
        <strong>1&nbsp;150&nbsp;Kč za osobu, se snídaní</strong>. Kapacita je
        omezená, místa přidělujeme postupně podle toho, jak se hlásíte. Dejte nám
        vědět, kolik vás přijede.
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
        <p className="ubytovani-dekujeme" role="status">
          Děkujeme, máme to zapsané! Ozveme se vám s detaily.
        </p>
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
