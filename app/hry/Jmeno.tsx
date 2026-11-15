"use client";

import { useEffect, useState } from "react";
import { chybaZVyjimky, prectiChybu, type Chyba } from "@/lib/chyby";
import { deviceId } from "@/lib/deviceId";
import s from "./hra.module.css";

const KLIC = "kj-jmeno";

/** Jméno k zařízení — v žebříčku místo „Neznámý host“. Cache v localStorage,
    pravda v Redisu (svatba:hoste). */
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
  const [chyba, setChyba] = useState<Chyba | null>(null);
  const id = kompaktni ? "jmeno-hosta-panel" : "jmeno-hosta";

  useEffect(() => {
    let cache = "";
    try {
      cache = localStorage.getItem(KLIC) ?? "";
    } catch {
      /* úložiště nedostupné (soukromé okno) — jméno přijde ze serveru */
    }
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
          } catch {
            /* úložiště nedostupné — jméno drží server */
          }
        }
      })
      .catch(() => {
        /* bez signálu zůstane jméno z telefonu */
      });
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
      if (!r.ok) {
        // server ví proč (jméno s nepovolenými znaky × výpadek) — řekneme to hostovi
        setChyba(await prectiChybu(r));
        setStav("chyba");
        return;
      }
      setUlozene(t);
      setStav("ok");
      try {
        localStorage.setItem(KLIC, t);
      } catch {
        /* úložiště nedostupné — jméno drží server */
      }
      onZmena?.(t);
    } catch (error) {
      setChyba(chybaZVyjimky(error));
      setStav("chyba");
    }
  }

  let zprava = "Platí pro tohle zařízení, účet netřeba.";
  if (stav === "ok") zprava = "Uloženo.";
  else if (stav === "chyba") zprava = chyba?.hlaska ?? "Nepovedlo se.";
  else if (stav === "ukladam") zprava = "Ukládám…";

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
