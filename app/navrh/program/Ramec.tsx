import Link from "next/link";
import Kniha from "@/app/menu/Kniha";
import s from "./ramec.module.css";

/** Rám návrhu programu: sekce programu tak, jak sedí na webu (béžový pruh,
    kytice vlevo nahoře, nadpis), a pod ní svatební menu — ať je vidět, jak
    na sebe navazují. Hlavička je nízká, rozcestník ukazuje stránku zmenšenou. */
export default function Ramec({
  kod,
  nazev,
  popis,
  children,
}: {
  kod: string;
  nazev: string;
  popis: string;
  children: React.ReactNode;
}) {
  return (
    <main className={s.stranka}>
      <header className={s.hlava}>
        <Link href="/navrh#program" className={s.zpet}>← Návrhy</Link>
        <h1 className={s.nazev}>
          <span className={s.kod}>{kod}</span> {nazev}
        </h1>
      </header>
      <div className="obsah-ramec">
        <section className="schedule" id="schedule">
          <img className="program-kytice program-kytice-vlevo" src="/kytky/kytice_program_vlevo.webp?v=4" alt="" aria-hidden="true" />
          <div className="wrap">
            <p className="eyebrow">Nahlédněte</p>
            <h2>Program dne</h2>
          </div>
          <div className={s.telo}>{children}</div>
        </section>
        <section className="menu" id="menu">
          <img className="program-kytice menu-kytice" src="/kytky/kytice_program_vpravo.webp?v=4" alt="" aria-hidden="true" />
          <div className="wrap">
            <p className="eyebrow">Dobrou chuť</p>
            <h2>Svatební menu</h2>
          </div>
          <div className={s.telo}>
            <Kniha />
          </div>
        </section>
      </div>
      <p className={s.popis}>{popis}</p>
    </main>
  );
}
