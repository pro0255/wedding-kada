import type { Metadata } from "next";
import Ramec from "../Ramec";
import Snura from "./Snura";

export const metadata: Metadata = { title: "Příběh — S1: fotky na šňůře", robots: { index: false, follow: false } };

export default function Stranka() {
  return (
    <Ramec
      kod="S1"
      nazev="Fotky na šňůře"
      popis="Polaroidy visí na provázku dřevěnými kolíčky a šňůra se mírně prověšuje. Táhne se prstem nebo myší, na počítači i šipkami. Při najetí myší se fotka zhoupne. Pod šňůrou dopis. Popisky jsou text v ručním písmu La Belle Aurore."
    >
      <Snura />
    </Ramec>
  );
}
