import type { Metadata } from "next";
import Scena from "../_spolecne/Scena";
import ObalkaCss from "./ObalkaCss";

export const metadata: Metadata = { title: "Návrh obálky V2 — CSS 3D", robots: { index: false } };

export default function Page() {
  return (
    <Scena
      nazev="V2 — čisté CSS 3D"
      popis="Chlopeň na skutečném pantu (rotateX), podšívka na rubu, pečeť se rozlomí, přeložený dopis vyjede a rozloží se. Bez JS animací, ~0 kB navíc."
    >
      <ObalkaCss />
    </Scena>
  );
}
