import type { Metadata } from "next";
import Ramec from "../Ramec";
import Kapsa from "./Kapsa";

export const metadata: Metadata = {
  title: "Menu — návrh 3: karty v kapse",
  robots: { index: false, follow: false },
};

export default function Stranka() {
  return (
    <Ramec
      cislo="3"
      nazev="Karty v kapse"
      popis="Dvě karty vykukují z papírové kapsy. Vytáhnou se nahoru, kapsa klesne a zmizí a karty se rozloží vedle sebe. Na telefonu se karty míchají."
    >
      <Kapsa />
    </Ramec>
  );
}
