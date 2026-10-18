import type { Metadata } from "next";
import Scena from "../_spolecne/Scena";
import ObalkaLazy from "./ObalkaLazy";

export const metadata: Metadata = { title: "Návrh obálky V1 — three.js model", robots: { index: false } };

export default function Page() {
  return (
    <Scena
      kytkyPredObalkou={false}
      nazev="V1 — skutečný 3D model (three.js)"
      popis="CC0 model obálky (reyshapes, Poly Pizza) rozříznutý na tělo a chlopeň na pantu, měkké stíny, zrno papíru, pečeť se rozlomí, přeložený dopis vyjede a rozloží se. Snítka v rohu je ve 3D a vrhá skutečný stín na obálku. Myš obálku naklání. three.js + GSAP, načítá se líně."
    >
      <ObalkaLazy />
    </Scena>
  );
}
