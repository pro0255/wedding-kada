"use client";

import { useState } from "react";
import type { HraSlug } from "@/lib/hra";
import Hra from "../Hra";
import Zebricek from "../Zebricek";
import Jmeno from "../Jmeno";
import s from "../hra.module.css";

/** Spojuje hru, žebříček a jméno: po dohrání i po změně jména se žebříček obnoví.
    Na telefonu je hra první a přes celou obrazovku, žebříček až pod ní. */
export default function HraSeZebrickem({ hra }: { hra: HraSlug }) {
  const [obnovit, setObnovit] = useState(0);
  const obnov = () => setObnovit((n) => n + 1);
  return (
    <>
      <div className={s.hraObal}>
        <Hra hra={hra} onKonec={obnov} onJmeno={obnov} />
      </div>
      <Zebricek hra={hra} obnovit={obnovit} />
      <Jmeno onZmena={obnov} />
    </>
  );
}
