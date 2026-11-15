"use client";

import type { Chyba } from "@/lib/chyby";
import s from "./chyba.module.css";
import { KONTAKTY, formatTel, maTelefon } from "./kontakty";

/* Kam dál, když něco nejde: svědci. Dokud v kontakty.ts nejsou skutečná
   čísla, ukáže se jen jména bez odkazů. */
export function Svedci() {
  const sTelefonem = KONTAKTY.filter(maTelefon);
  if (sTelefonem.length === 0) {
    return (
      <div className={s.svedci}>
        <p>Nejde to? Poradí svědci — {KONTAKTY.map((k) => k.jmeno).join(" nebo ")}.</p>
      </div>
    );
  }
  return (
    <div className={s.svedci}>
      <p>Nejde to? Poradí svědci:</p>
      <ul>
        {sTelefonem.map((k) => (
          <li key={k.jmeno}>
            <span>{k.jmeno}</span>
            <a href={`tel:${k.tel}`}>{formatTel(k.tel)}</a>
            <a href={`https://wa.me/${k.tel.replace("+", "")}`} target="_blank" rel="noopener">
              WhatsApp
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Hláška typované chyby (lib/chyby.ts). Podle katalogu přidá tlačítko
 *  „Zkusit znovu“ (když ho místo umí — prop `znovu`) a kontakt na svědky. */
export default function ChybaHlaska({
  chyba,
  znovu,
  className = "",
}: {
  chyba: Chyba | null;
  znovu?: () => void;
  className?: string;
}) {
  if (!chyba) return null;
  return (
    <div className={`${s.chyba} ${className}`} role="alert">
      <p>{chyba.hlaska}</p>
      {chyba.znovu && znovu && (
        <button type="button" className={s.znovu} onClick={znovu}>
          Zkusit znovu
        </button>
      )}
      {chyba.kontakt && <Svedci />}
    </div>
  );
}
