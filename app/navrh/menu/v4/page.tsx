import type { Metadata } from "next";
import Ramec from "../Ramec";
import Kniha3D from "./Kniha3D";

export const metadata: Metadata = {
  title: "Menu — návrh 4: kniha ve WebGL",
  robots: { index: false, follow: false },
};

export default function Stranka() {
  return (
    <Ramec
      cislo="4"
      nazev="Kniha ve WebGL"
      popis="Kniha z návrhu 1 jako skutečný 3D objekt: desky s tloušťkou, hřbet, blok listů, zlatá ražba, která reaguje na světlo, a svatební květiny na stole. Klepnutím se otevře i zavře, na telefonu se listuje tažením nebo tlačítky."
    >
      <Kniha3D />
    </Ramec>
  );
}
