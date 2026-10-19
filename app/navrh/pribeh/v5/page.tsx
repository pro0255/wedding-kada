import type { Metadata } from "next";
import { La_Belle_Aurore } from "next/font/google";
import Ramec from "../Ramec";
import Pribeh from "./Pribeh";

export const metadata: Metadata = { title: "Příběh — S5: příběh při scrollu", robots: { index: false, follow: false } };

// rukopis popisků na polaroidech — latin-ext kvůli háčkům a čárkám
const rukopis = La_Belle_Aurore({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--rukopis-s5",
  preload: false,
});

export default function Stranka() {
  return (
    <Ramec
      kod="S5"
      nazev="Příběh při scrollu"
      popis="Dopis se čte při posouvání stránky: věty naskakují jedna po druhé, předchozí se ztlumí, a ke každé větě někdo položí na stůl dvě tři fotky. Na konci podpis a datum. Nic se neklepe — stačí scrollovat. Popisky fotek rukopisem La Belle Aurore."
    >
      <div className={rukopis.variable}>
        <Pribeh />
      </div>
    </Ramec>
  );
}
