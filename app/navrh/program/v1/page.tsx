import type { Metadata } from "next";
import Ramec from "../Ramec";
import { PROGRAM } from "../data";
import s from "./karta.module.css";

export const metadata: Metadata = { title: "Program — H1: tištěná karta", robots: { index: false, follow: false } };

export default function Stranka() {
  return (
    <Ramec
      kod="H1"
      nazev="Tištěná karta"
      popis="Program jako tištěná karta na stole — stejný papír a zlatý rámeček jako svatební menu, takže program, menu, obálka i polaroidy jsou jedna papírenská sada. Body pod sebou: čas, kresba, název a popis. Čte se jako jízdní řád, na telefonu stejně."
    >
      <article className={s.karta}>
        <p className={s.datum}>Sobota 18. září 2027</p>
        <ol className={s.seznam}>
          {PROGRAM.map((b) => (
            <li key={b.nazev} className={s.bod}>
              <span className={s.cas}>{b.cas}</span>
              <img className={s.ikona} src={`/program/${b.ikona}.webp`} alt="" aria-hidden="true" />
              <span className={s.text}>
                <span className={s.nazev}>{b.nazev}</span>
                {b.misto && <span className={s.misto}>{b.misto}</span>}
                <span className={s.popis}>{b.popis}</span>
              </span>
            </li>
          ))}
        </ol>
      </article>
    </Ramec>
  );
}
