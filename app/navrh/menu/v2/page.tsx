import type { Metadata } from "next";
import Ramec from "../Ramec";
import Skladacka from "./Skladacka";

export const metadata: Metadata = {
  title: "Menu — návrh 2: trojdílná skládačka",
  robots: { index: false, follow: false },
};

export default function Stranka() {
  return (
    <Ramec
      cislo="2"
      nazev="Trojdílná skládačka"
      popis="Menu stojí uprostřed, obálka se odklopí doprava a úvodní křídlo doleva — postupně, s lehkým překmitem papíru. Na telefonu se rozkládá svisle."
    >
      <Skladacka />
    </Ramec>
  );
}
