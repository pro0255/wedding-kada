"use client";

import { useEffect } from "react";
import s from "./chyba.module.css";
import { Svedci } from "./ChybaHlaska";

/* Když se stránka při vykreslení rozbije: místo bílé obrazovky hláška,
   druhý pokus, cesta domů a kontakt na svědky. */
export default function Chyba({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("[web] Stránka spadla:", error);
  }, [error]);

  return (
    <main className={s.stranka}>
      <h1>Tady se něco pokazilo</h1>
      <p>Omlouváme se — stránku se nepodařilo zobrazit. Většinou pomůže zkusit to znovu.</p>
      <div className={s.akce}>
        <button type="button" className={s.tlacitko} onClick={() => retry()}>
          Zkusit znovu
        </button>
        {/* celé načtení, ne <Link> — po pádu chceme čistý start */}
        <a href="/" className={s.tlacitko}>
          Zpátky na svatbu
        </a>
      </div>
      <Svedci />
    </main>
  );
}
