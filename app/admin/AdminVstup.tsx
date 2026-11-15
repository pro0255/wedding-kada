"use client";

import { useState } from "react";
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
      const d: { spravce?: boolean } = r.ok ? await r.json().catch(() => ({})) : {};
      if (d.spravce) {
        // celé načtení, ať proxy uvidí novou cookie
        window.location.assign(dal);
        return;
      }
      setHlaska(
        r.status === 429 ? "Moc pokusů. Zkuste to za minutu." : "Tohle není správcovské heslo.",
      );
      setHeslo("");
    } catch {
      setHlaska("Něco se pokazilo. Zkuste to prosím znovu.");
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
