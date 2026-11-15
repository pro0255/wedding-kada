"use client";

import { useState } from "react";
import s from "./admin.module.css";

/* Zruší jen správcovskou cookie — vstup do galerie pro hosty zůstane. */
export default function Odhlasit() {
  const [bezi, setBezi] = useState(false);

  async function odhlasit() {
    setBezi(true);
    try {
      await fetch("/api/fotky/vstup", { method: "DELETE" });
    } finally {
      globalThis.location.reload();
    }
  }

  return (
    <p className={s.odhlasit}>
      <button type="button" className={s.odkazTlacitko} onClick={odhlasit} disabled={bezi}>
        {bezi ? "Odhlašuji…" : "Odhlásit správce"}
      </button>
    </p>
  );
}
