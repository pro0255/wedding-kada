import type { Metadata } from "next";
import Ramec from "../Ramec";
import { PROGRAM } from "../data";
import s from "./rada.module.css";

export const metadata: Metadata = { title: "Program — H4: řada jako odpočet", robots: { index: false, follow: false } };

export default function Stranka() {
  return (
    <Ramec
      kod="H4"
      nazev="Řada jako odpočet"
      popis="Nejmenší změna: vodorovná řada zůstává, ale mluví stejnou řečí jako odpočet nahoře — čas velkými patkovými číslicemi místo pilulek, body oddělené svislými vlásečnicemi, žádná vodorovná čára. Kresby jsou větší a sloupce širší, takže se text láme méně."
    >
      <ol className={s.rada}>
        {PROGRAM.map((b) => (
          <li key={b.nazev} className={s.bod}>
            <img className={s.ikona} src={`/program/${b.ikona}.webp`} alt="" aria-hidden="true" />
            <span className={s.cas}>{b.cas}</span>
            <span className={s.nazev}>{b.nazev}</span>
            {b.misto && <span className={s.misto}>{b.misto}</span>}
            <span className={s.popis}>{b.popis}</span>
          </li>
        ))}
      </ol>
    </Ramec>
  );
}
