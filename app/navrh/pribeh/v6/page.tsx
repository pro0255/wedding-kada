import type { Metadata } from "next";
import { Courier_Prime } from "next/font/google";
import Ramec from "../Ramec";
import Film from "./Film";

export const metadata: Metadata = { title: "Příběh — S6: kontaktní arch", robots: { index: false, follow: false } };

// psací stroj na dopis a popisky snímků — latin-ext kvůli háčkům a čárkám
const stroj = Courier_Prime({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  variable: "--stroj-s6",
  preload: false,
});

export default function Stranka() {
  return (
    <Ramec
      kod="S6"
      nazev="Kontaktní arch"
      popis="Fotky jako z fotokomory: tmavý filmový pás s perforací a číslováním snímků, popisky psacím strojem. Pás se táhne do strany prstem nebo myší, klepnutí na políčko ho zvětší jako lupou. Dopis je strojopisný list vedle pásu. Písmo popisků Courier Prime."
    >
      <div className={stroj.variable}>
        <Film />
      </div>
    </Ramec>
  );
}
