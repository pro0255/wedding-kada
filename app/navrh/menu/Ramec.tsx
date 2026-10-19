import Link from "next/link";
import s from "./ramec.module.css";

/** Společný rám návrhové stránky. Hlavička je záměrně nízká — rozcestník
    /navrh ukazuje stránky zmenšené v okně 1280 × 1040 a 390 × 844 a scéna
    se tam musí vejít celá. Popis je až pod scénou. */
export default function Ramec({
  cislo,
  nazev,
  popis,
  children,
}: {
  cislo: string;
  nazev: string;
  popis: string;
  children: React.ReactNode;
}) {
  return (
    <main className={s.stranka}>
      <header className={s.hlava}>
        <Link href="/navrh" className={s.zpet}>← Návrhy</Link>
        <h1 className={s.nazev}>
          <span className={s.cislo}>Menu {cislo}</span> {nazev}
        </h1>
      </header>
      <section className={s.scena} aria-label="Svatební menu">
        {children}
      </section>
      <p className={s.popis}>{popis}</p>
    </main>
  );
}
