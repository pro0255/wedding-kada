"use client";

import { useState } from "react";
import { chybaZVyjimky, prectiChybu } from "@/lib/chyby";
import { deviceId } from "@/lib/deviceId";
import s from "./admin.module.css";

/* Přihlášení správce. Jde přes stejné dveře jako vstup do galerie
   (/api/fotky/vstup) — sdílí s nimi limit pokusů i správcovskou cookie.
   Heslo pro hosty sem nepustí; hláška ale neprozradí, že bylo platné. */
export default function AdminVstup({ dal }: { dal: string }) {
  const [heslo, setHeslo] = useState("");
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [odesila, setOdesila] = useState(false);

  async function odeslat(e: React.FormEvent) {
    e.preventDefault();
    const odpoved = heslo.trim();
    if (!odpoved || odesila) return;
    setOdesila(true);
    setHlaska(null);
    try {
      const r = await fetch("/api/fotky/vstup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ odpoved, deviceId: deviceId() }),
      });
      if (!r.ok) {
        /* Dřív každé odmítnutí hlásilo „není správcovské heslo“ — i výpadek
           serveru, takže správné heslo vypadalo jako špatné. */
        const duvod = await prectiChybu(r);
        let zprava = duvod.hlaska;
        if (duvod.kod === "spatna-odpoved") zprava = "Tohle není správcovské heslo.";
        else if (duvod.kod === "moc-pokusu") zprava = "Moc pokusů. Zkuste to za minutu.";
        setHlaska(zprava);
        if (duvod.kod === "spatna-odpoved" || duvod.kod === "moc-pokusu") setHeslo("");
        return;
      }
      const d: { spravce?: boolean } = await r.json().catch(() => ({}));
      if (d.spravce) {
        // celé načtení, ať proxy uvidí novou cookie
        globalThis.location.assign(dal);
        return;
      }
      setHlaska("Tohle není správcovské heslo.");
      setHeslo("");
    } catch (error) {
      setHlaska(chybaZVyjimky(error).hlaska);
    } finally {
      setOdesila(false);
    }
  }

  return (
    <form className={s.vstup} onSubmit={odeslat}>
      <label className={s.vstupPopisek} htmlFor="admin-heslo">
        Heslo
      </label>
      <input
        id="admin-heslo"
        className={s.vstupPole}
        type="password"
        autoComplete="current-password"
        autoFocus
        maxLength={60}
        value={heslo}
        onChange={(e) => setHeslo(e.target.value)}
      />
      <button className={s.tlacitko} type="submit" disabled={odesila || !heslo.trim()}>
        {odesila ? "Ověřuji…" : "Vstoupit"}
      </button>
      <p className={s.hlaska} role="alert" aria-live="polite">
        {hlaska}
      </p>
    </form>
  );
}
