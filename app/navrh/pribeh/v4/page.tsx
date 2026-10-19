import type { Metadata } from "next";
import Ramec from "../Ramec";
import Kapitoly from "./Kapitoly";

export const metadata: Metadata = { title: "Příběh — S4: kapitoly", robots: { index: false, follow: false } };

export default function Stranka() {
  return (
    <Ramec
      kod="S4"
      nazev="Kapitoly"
      popis="Časopisecká dvoustrana bez papírových rekvizit. Dopis je rozdělený do šesti kapitol — vlevo velké číslo, název a věta dopisu, vpravo velká fotka a k ní dvě tři menší, na které jde klepnout. Kapitoly se přepínají nahoře na tenké ose, šipkami, klávesnicí i tahem prstu. Popisky fotek drobnými proloženými verzálkami."
    >
      <Kapitoly />
    </Ramec>
  );
}
