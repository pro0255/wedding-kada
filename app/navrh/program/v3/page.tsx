import type { Metadata } from "next";
import Ramec from "../Ramec";
import { PULKY } from "../data";
import s from "./pulky.module.css";

export const metadata: Metadata = { title: "Program — H3: dvě půlky dne", robots: { index: false, follow: false } };

export default function Stranka() {
  return (
    <Ramec
      kod="H3"
      nazev="Dvě půlky dne"
      popis="Den rozdělený na dvě karty: Obřad (snídaně, obřad, oběd) a Oslava (dort, tanec, odpoledne, párty). Karty leží vedle sebe lehce natočené jako polaroidy v příběhu — papírové objekty jako zbytek webu. Místo sedmi úzkých sloupců dva čitelné; host hned vidí, kdy je slavnostní část a kdy zábava."
    >
      <div className={s.pulky}>
        {PULKY.map((p, i) => (
          <article key={p.nazev} className={s.karta}>
            <p className={s.stitek}>{i === 0 ? "Dopoledne" : "Odpoledne a večer"}</p>
            <h3 className={s.nadpis}>{p.nazev}</h3>
            <ol className={s.seznam}>
              {p.body.map((b) => (
                <li key={b.nazev} className={s.bod}>
                  <img className={s.ikona} src={`/program/${b.ikona}.webp`} alt="" aria-hidden="true" />
                  <span className={s.text}>
                    <span className={s.cas}>{b.cas}</span>
                    <span className={s.nazev}>{b.nazev}</span>
                    {b.misto && <span className={s.misto}>{b.misto}</span>}
                    <span className={s.popis}>{b.popis}</span>
                  </span>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </Ramec>
  );
}
