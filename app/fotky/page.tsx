import type { Metadata } from "next";
import FotoGalerie from "../FotoGalerie";

export const metadata: Metadata = {
  title: "Fotky ze svatby · Kateřina & Jakub",
  description: "Nahrajte fotky a videa ze svatby přímo z mobilu.",
};

/** Samostatná stránka za QR kódem vyvěšeným na svatbě — bez obálky a loaderu.
    Odkazuje na ni i sekce „Fotky od vás“ na hlavní stránce. */
export default function FotkyStranka() {
  return (
    <main className="galerie-stranka">
      <section className="galerie">
        <div className="wrap">
          <p className="eyebrow">Vzpomínky</p>
          <h2>Fotky od vás</h2>
          <p className="lead">
            Vyfoťte, nahrajte, rozdávejte srdíčka. Fotky i videa se tu objeví
            všem — díky, že nám pomáháte posbírat celý den.
          </p>
        </div>
        <FotoGalerie />
      </section>
    </main>
  );
}
