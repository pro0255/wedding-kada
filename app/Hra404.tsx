"use client";

import { useState } from "react";
import type { HraSlug } from "@/lib/schemata";
import { HRY_REGISTR } from "./hry/hry";
import HraSeZebrickem from "./hry/[hra]/HraSeZebrickem";
import VyberHry from "./hry/VyberHry";
import s from "./not-found.module.css";

type Faze = { typ: "uvod" } | { typ: "vyber" } | { typ: "hra"; hra: HraSlug };

/** 404 ve třech krocích: text (klik kamkoliv) → výběr hry s lídry → hra. */
export default function Hra404() {
  const [faze, setFaze] = useState<Faze>({ typ: "uvod" });

  if (faze.typ === "uvod") {
    return (
      <button type="button" className={s.uvod} onClick={() => setFaze({ typ: "vyber" })}>
        <span className={s.kod}>404</span>
        <span className={s.nadpis}>Tady se nikdo nebere</span>
        <span className={s.podtitul}>
          Tahle stránka se někam zatoulala. Než ji najdeme, zahraj si.
        </span>
        <span className={s.vyzva}>Klepni kamkoliv</span>
      </button>
    );
  }

  if (faze.typ === "vyber") {
    return (
      <div className={s.blok}>
        <p className={s.kod}>404</p>
        <h1 className={s.nadpis}>Vyber si hru</h1>
        <p className={s.podtitul}>Každá má svůj žebříček. Porazíš toho, kdo právě vede?</p>
        <VyberHry onVyber={(hra) => setFaze({ typ: "hra", hra })} />
      </div>
    );
  }

  const def = HRY_REGISTR[faze.hra];
  return (
    <div className={s.blok}>
      <button type="button" className={s.zpet} onClick={() => setFaze({ typ: "vyber" })}>
        ← Jiná hra
      </button>
      <h1 className={s.nadpis}>{def.nazev}</h1>
      <p className={s.podtitul}>{def.popis}</p>
      <HraSeZebrickem hra={faze.hra} />
    </div>
  );
}
