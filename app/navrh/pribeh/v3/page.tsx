import type { Metadata } from "next";
import Ramec from "../Ramec";
import ObalkaFotek from "./ObalkaFotek";

export const metadata: Metadata = { title: "Příběh — S3: obálka plná fotek", robots: { index: false, follow: false } };

export default function Stranka() {
  return (
    <Ramec
      kod="S3"
      nazev="Obálka plná fotek"
      popis="Jedna velká zapečetěná obálka. Po klepnutí na pečeť se rozlomí, chlopeň se otevře a z obálky vyjedou všechny fotky i dopis a rozloží se do vějíře jako karty v ruce. Vpředu je dopis; klepnutím na kartu ve vějíři jde dopředu ona, šipkami nebo tahem prstu se listuje. Zavřít = všechno zpátky do obálky. Popisky kurzívou Cormorant."
    >
      <ObalkaFotek />
    </Ramec>
  );
}
