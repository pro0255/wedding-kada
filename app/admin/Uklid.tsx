"use client";

import { useState } from "react";
import { chybaZVyjimky, prectiChybu } from "@/lib/chyby";
import type { PrehledUklidu } from "@/lib/uklid";
import s from "./admin.module.css";

/* Úklid testovacích dat před ostrým provozem. Dvě pojistky: nejdřív se
   tlačítko rozbalí a ukáže, co zmizí, a smazat jde až po novém zadání
   správcovského hesla. Rezervace zůstávají vždy. */
export default function Uklid({
  prehled,
  nazvyHer,
}: {
  prehled: PrehledUklidu;
  nazvyHer: Record<string, string>;
}) {
  const [otevreno, setOtevreno] = useState(false);
  const [heslo, setHeslo] = useState("");
  const [bezi, setBezi] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [hotovo, setHotovo] = useState(false);

  const skore = Object.values(prehled.skore).reduce((a, b) => a + b, 0);
  const prazdno = skore + prehled.jmena + prehled.fotky + prehled.lajky === 0;

  async function smazat(e: React.FormEvent) {
    e.preventDefault();
    if (!heslo.trim() || bezi) return;
    setBezi(true);
    setHlaska(null);
    try {
      const r = await fetch("/api/admin/uklid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heslo }),
      });
      if (!r.ok) {
        const duvod = await prectiChybu(r);
        setHlaska(duvod.kod === "spatna-odpoved" ? "Tohle není správcovské heslo." : duvod.hlaska);
        setHeslo("");
        return;
      }
      setHotovo(true);
      // čísla v celém rozcestníku se načtou znovu
      globalThis.setTimeout(() => globalThis.location.reload(), 1500);
    } catch (error) {
      setHlaska(chybaZVyjimky(error).hlaska);
    } finally {
      setBezi(false);
    }
  }

  if (hotovo) {
    return (
      <p className={s.uklidHotovo} role="status">
        Smazáno. Rezervace zůstaly.
      </p>
    );
  }

  return (
    <div className={s.uklid}>
      <ul className={s.seznam}>
        {Object.entries(prehled.skore).map(([hra, n]) => (
          <li key={hra}>
            <span>Skóre · {nazvyHer[hra] ?? hra}</span>
            <span className={s.seznamCislo}>{n}</span>
          </li>
        ))}
        <li>
          <span>Jména hostů</span>
          <span className={s.seznamCislo}>{prehled.jmena}</span>
        </li>
        <li>
          <span>Fotky a videa (i v Cloudinary)</span>
          <span className={s.seznamCislo}>{prehled.fotky}</span>
        </li>
        <li>
          <span>Srdíčka</span>
          <span className={s.seznamCislo}>{prehled.lajky}</span>
        </li>
      </ul>

      {otevreno ? (
        <form className={s.uklidForm} onSubmit={smazat}>
          <p className={s.uklidVaro}>
            Všechno výše se smaže natrvalo a nejde to vrátit. Pro potvrzení zadejte správcovské
            heslo.
          </p>
          <label className={s.vstupPopisek} htmlFor="uklid-heslo">
            Správcovské heslo
          </label>
          <input
            id="uklid-heslo"
            className={s.vstupPole}
            type="password"
            autoComplete="current-password"
            autoFocus
            maxLength={60}
            value={heslo}
            onChange={(e) => setHeslo(e.target.value)}
          />
          <div className={s.uklidTlacitka}>
            <button
              className={`${s.tlacitko} ${s.tlacitkoNebezpecne}`}
              type="submit"
              disabled={bezi || !heslo.trim()}
            >
              {bezi ? "Mažu…" : "Smazat natrvalo"}
            </button>
            <button
              type="button"
              className={s.odkazTlacitko}
              onClick={() => {
                setOtevreno(false);
                setHeslo("");
                setHlaska(null);
              }}
            >
              Zrušit
            </button>
          </div>
          <p className={s.hlaska} role="alert" aria-live="polite">
            {hlaska}
          </p>
        </form>
      ) : (
        <button
          type="button"
          className={`${s.tlacitko} ${s.tlacitkoNebezpecne}`}
          onClick={() => setOtevreno(true)}
          disabled={prazdno}
        >
          {prazdno ? "Není co mazat" : "Smazat testovací data…"}
        </button>
      )}
    </div>
  );
}
