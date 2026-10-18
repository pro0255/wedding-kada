import type { Metadata } from "next";
import Ramec from "../Ramec";
import KnihaPrstynky from "./KnihaPrstynky";

export const metadata: Metadata = {
  title: "Menu — návrh 5: kniha a 3D prstýnky",
  robots: { index: false, follow: false },
};

export default function Stranka() {
  return (
    <Ramec
      cislo="5"
      nazev="Kniha a 3D prstýnky"
      popis="DOM kniha z návrhu 1 beze změny. Vedle ní na stole leží dva zlaté prstýnky ve WebGL — stejné zlato jako prsten v úvodu webu — a při otevření po nich přejede odlesk. Kolem svatební květiny."
    >
      <KnihaPrstynky />
    </Ramec>
  );
}
