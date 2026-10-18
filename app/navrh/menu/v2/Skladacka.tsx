"use client";

import { startTransition, useState } from "react";
import { Lic, Ornament, StranaDeti, StranaDospeli, StranaUvod } from "../obsah";
import s from "./skladacka.module.css";

/* Návrh 2 — trojdílná skládačka (roll fold), jak se tisknou restaurační menu.

   Prostřední panel s menu stojí pořád na místě. Pravý panel je přeložený
   navrch (jeho rub je obálka), levý panel leží pod ním. Po klepnutí se nejdřív
   odklopí obálka doprava, a s malým zpožděním levé křídlo doleva — obě
   s mírným překmitem, jako když se tuhý papír narovná. Zavírá se v opačném
   pořadí.

   Na telefonu se skládá svisle: obálka se odklopí dolů, horní křídlo nahoru
   a celá sestava se mezitím sveze o panel níž, aby začínala tam, kde stála
   zavřená karta.

   Animují se jen transform a opacity (žádný layout). Výška místa na telefonu
   se přepne jednorázově — při otevření hned, při zavření až po doběhnutí. */
export default function Skladacka() {
  const [otevrene, setOtevrene] = useState(false);
  // V přechodu: React sestaví změnu po kouskách a klepnutí nic nezdrží.
  const prepni = () => startTransition(() => setOtevrene((o) => !o));

  return (
    <div className={s.obal}>
      <div className={s.misto + (otevrene ? " " + s.otevrene : "")}>
        <div className={s.sestava}>
          <div className={s.stred} id="menu-v2-obsah" inert={!otevrene}>
            <StranaDospeli sUvodem={false} />
            <div className={s.stinStred} aria-hidden="true" />
          </div>

          {/* Levé (na telefonu horní) křídlo: úvod a poznámka o stravování. */}
          <div className={s.kridlo + " " + s.levy}>
            <div className={s.licKridla} inert={!otevrene}>
              <StranaUvod />
              <div className={s.stinKridla} aria-hidden="true" />
            </div>
            <div className={s.rubKridla} aria-hidden="true">
              <span className={s.rubOzdoba}><Ornament /></span>
            </div>
          </div>

          {/* Pravé (na telefonu spodní) křídlo: uvnitř dětské menu, zvenku obálka. */}
          <div className={s.kridlo + " " + s.pravy}>
            <div className={s.licKridla} inert={!otevrene}>
              <StranaDeti />
              <div className={s.stinKridla} aria-hidden="true" />
            </div>
            <button
              type="button"
              className={s.rubKridla + " " + s.obalka}
              onClick={prepni}
              aria-expanded={otevrene}
              aria-controls="menu-v2-obsah"
              aria-label="Otevřít svatební menu"
              tabIndex={otevrene ? -1 : 0}
            >
              <Lic />
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={s.tlacitko}
        onClick={prepni}
        aria-expanded={otevrene}
        aria-controls="menu-v2-obsah"
      >
        {otevrene ? "Složit menu" : "Rozložit menu"}
      </button>
    </div>
  );
}
