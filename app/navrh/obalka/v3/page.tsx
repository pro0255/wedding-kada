import type { Metadata } from "next";
import Scena from "../_spolecne/Scena";
import ObalkaGsap from "./ObalkaGsap";

export const metadata: Metadata = { title: "Návrh obálky V3 — GSAP, adresa a rub", robots: { index: false } };

export default function Page() {
  return (
    <Scena
      nazev="V3 — dopis poštou (GSAP)"
      popis="Obálka leží adresou nahoru se známkou a razítkem Rekovic. Klepnutí: zvedne se a otočí na rub, pečeť praskne se zlatými jiskrami, chlopeň se otevře a dopis vyjede a rozloží se. Myš ji jemně naklání. GSAP ~27 kB gzip."
    >
      <ObalkaGsap />
    </Scena>
  );
}
