import type { Metadata } from "next";
import FotoGalerie from "../FotoGalerie";

export const metadata: Metadata = {
  title: "Fotky ze svatby · Kateřina & Jakub",
  description: "Nahrajte fotky ze svatby přímo z mobilu.",
};

/** Samostatná stránka pro QR kódy na stolech — bez obálky a loaderu. */
export default function FotkyStranka() {
  return (
    <main className="galerie-stranka">
      <section className="galerie">
        <div className="wrap">
          <p className="eyebrow">Vzpomínky</p>
          <h2>Fotky od vás</h2>
          <p className="lead">
            Vyfoťte, nahrajte, rozdávejte srdíčka. Fotky se tu objeví všem —
            díky, že nám pomáháte posbírat celý den.
          </p>
        </div>
        <FotoGalerie />
      </section>
    </main>
  );
}
