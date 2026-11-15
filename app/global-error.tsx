"use client";

import { useEffect } from "react";
import { Svedci } from "./ChybaHlaska";
import s from "./chyba.module.css";

/* Pád už v kořenovém layoutu. Kreslí vlastní <html> a nemá globals.css ani
   písma — chyba.module.css proto nese záložní barvy. */
export default function GlobalniChyba({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error("[web] Web spadl:", error);
  }, [error]);

  return (
    <html lang="cs">
      <body style={{ margin: 0 }}>
        <title>Něco se pokazilo — Kateřina &amp; Jakub</title>
        <main className={s.stranka}>
          <h1>Tady se něco pokazilo</h1>
          <p>Omlouváme se — web se nepodařilo zobrazit. Většinou pomůže zkusit to znovu.</p>
          <div className={s.akce}>
            <button type="button" className={s.tlacitko} onClick={() => retry()}>
              Zkusit znovu
            </button>
            <a href="/" className={s.tlacitko}>
              Zpátky na svatbu
            </a>
          </div>
          <Svedci />
        </main>
      </body>
    </html>
  );
}
