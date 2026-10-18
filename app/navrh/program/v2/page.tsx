import type { Metadata } from "next";
import Ramec from "../Ramec";
import { PROGRAM } from "../data";
import s from "./osa.module.css";

export const metadata: Metadata = { title: "Program — H2: svislá osa", robots: { index: false, follow: false } };

export default function Stranka() {
  return (
    <Ramec
      kod="H2"
      nazev="Svislá osa"
      popis="Den plyne shora dolů po jedné tenké lince uprostřed. Čas stojí velkým patkovým písmem jako číslice v odpočtu, kresba a text na druhé straně — strany se střídají, takže se oko houpe jako při čtení pozvánky. Sedm bodů už se nemačká do sedmi úzkých sloupců. Na telefonu linka vlevo."
    >
      <ol className={s.osa}>
        {PROGRAM.map((b) => (
          <li key={b.nazev} className={s.bod}>
            <span className={s.cas}>{b.cas}</span>
            <span className={s.tecka} aria-hidden="true" />
            <span className={s.obsah}>
              <img className={s.ikona} src={`/program/${b.ikona}.webp`} alt="" aria-hidden="true" />
              <span className={s.text}>
                <span className={s.nazev}>{b.nazev}</span>
                {b.misto && <span className={s.misto}>{b.misto}</span>}
                <span className={s.popis}>{b.popis}</span>
              </span>
            </span>
          </li>
        ))}
      </ol>
    </Ramec>
  );
}
