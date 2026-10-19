import Link from "next/link";
import s from "./ramec.module.css";

/** Rám návrhu příběhu: nízká hlavička s kódem a pod ní sekce tak, jak sedí
    na webu — bílá plocha, nad ní odpočet (béžový pruh) a pod ní místo konání
    (béžový pruh), ať je vidět, jak varianta navazuje. Nadpis sekce si každá
    varianta kreslí sama (některé ho mají uvnitř scény). Popis je pod scénou. */
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
        <Link href="/navrh#pribeh" className={s.zpet}>← Návrhy</Link>
        <h1 className={s.nazev}>
          <span className={s.kod}>{kod}</span> {nazev}
        </h1>
      </header>
      <div className={s.pruh} aria-hidden="true" />
      <section className={s.sekce} id="story">{children}</section>
      <div className={s.pruh} aria-hidden="true" />
      <p className={s.popis}>{popis}</p>
    </main>
  );
}
