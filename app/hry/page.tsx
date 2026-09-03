import type { Metadata } from "next";
import Link from "next/link";
import VyberHry from "./VyberHry";
import s from "./hry.module.css";

export const metadata: Metadata = {
  title: "Hry · Kateřina & Jakub",
  robots: { index: false },
};

/** Knihovna her — pro čekání u stolu i pro ztracené na 404. */
export default function HryStranka() {
  return (
    <main className={s.stranka}>
      <h1 className={s.nadpis}>Svatební hry</h1>
      <p className={s.popis}>
        Tři malé hry, tři žebříčky. Vyplň si u hry jméno a ukaž se ostatním.
      </p>
      <VyberHry />
      <Link href="/" className={s.tlacitko}>
        Zpátky na svatbu
      </Link>
    </main>
  );
}
