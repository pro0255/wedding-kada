"use client";

import { useEffect, useState } from "react";
import { deviceId } from "@/lib/deviceId";
import s from "./hra.module.css";

const KLIC = "kj-jmeno";

/** Jméno k zařízení — v žebříčku místo „Neznámý host“. Cache v localStorage,
    pravda v Airtable (Hoste). */
export default function Jmeno({
  onZmena,
  kompaktni = false,
}: {
  onZmena?: (jmeno: string) => void;
  kompaktni?: boolean;
}) {
  const [jmeno, setJmeno] = useState("");
  const [ulozene, setUlozene] = useState("");
  const [stav, setStav] = useState<"klid" | "ukladam" | "ok" | "chyba">("klid");
  const id = kompaktni ? "jmeno-hosta-panel" : "jmeno-hosta";

  useEffect(() => {
    let cache = "";
    try {
      cache = localStorage.getItem(KLIC) ?? "";
    } catch {}
    if (cache) {
      setJmeno(cache);
      setUlozene(cache);
    }
    fetch(`/api/host?device=${deviceId()}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ jmeno?: string | null }>) : null))
      .then((d) => {
        if (d?.jmeno) {
          setJmeno(d.jmeno);
          setUlozene(d.jmeno);
          try {
            localStorage.setItem(KLIC, d.jmeno);
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  async function uloz(e: React.FormEvent) {
    e.preventDefault();
    const t = jmeno.trim();
    if (!t || t === ulozene) return;
    setStav("ukladam");
    try {
      const r = await fetch("/api/host", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId: deviceId(), jmeno: t }),
      });
      if (!r.ok) throw new Error(String(r.status));
      setUlozene(t);
      setStav("ok");
      try {
        localStorage.setItem(KLIC, t);
      } catch {}
      onZmena?.(t);
    } catch {
      setStav("chyba");
    }
  }

  const zprava =
    stav === "ok"
      ? "Uloženo."
      : stav === "chyba"
        ? "Nepovedlo se, zkus to znovu."
        : stav === "ukladam"
          ? "Ukládám…"
          : "Platí pro tohle zařízení, účet netřeba.";

  return (
    <form className={s.jmenoForm} onSubmit={uloz}>
      <label htmlFor={id}>{kompaktni ? "Jméno do žebříčku" : "Tvoje jméno v žebříčku"}</label>
      <div className={s.jmenoRadek}>
        <input
          id={id}
          autoFocus={kompaktni}
          value={jmeno}
          maxLength={30}
          autoComplete="nickname"
          placeholder="např. Teta Jarka"
          onChange={(e) => {
            setJmeno(e.target.value);
            setStav("klid");
          }}
        />
        <button
          type="submit"
          disabled={stav === "ukladam" || !jmeno.trim() || jmeno.trim() === ulozene}
        >
          Uložit
        </button>
      </div>
      <p className={s.tlumene} aria-live="polite">
        {zprava}
      </p>
    </form>
  );
}
