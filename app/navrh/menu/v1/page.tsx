import type { Metadata } from "next";
import Ramec from "../Ramec";
import Kniha from "./Kniha";

export const metadata: Metadata = {
  title: "Menu — návrh 1: kniha s tloušťkou",
  robots: { index: false, follow: false },
};

export default function Stranka() {
  return (
    <Ramec
      cislo="1"
      nazev="Kniha s tloušťkou"
      popis="Desky jako kvádr s hranami a blokem listů. Deska se nadzvedne, přetočí přes hřbet s odleskem a dosedne s lehkým překmitem."
    >
      <Kniha />
    </Ramec>
  );
}
