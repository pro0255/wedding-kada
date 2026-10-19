import type { Metadata } from "next";
import Ramec from "../Ramec";
import Album from "./Album";

export const metadata: Metadata = { title: "Příběh — S2: fotoalbum", robots: { index: false, follow: false } };

export default function Stranka() {
  return (
    <Ramec
      kod="S2"
      nazev="Fotoalbum"
      popis="Rozevřené album v plátěných deskách barvy obálky. Na první straně dopis, dál fotky přichycené rožky a podepsané perem. Listuje se klepnutím na stranu, tahem prstu, šipkami nebo tlačítky; list se přetočí přes hřbet. Na telefonu jedna strana naráz."
    >
      <Album />
    </Ramec>
  );
}
