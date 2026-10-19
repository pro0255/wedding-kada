import type { Metadata } from "next";
import Link from "next/link";
import s from "./ramec.module.css";

export const metadata: Metadata = {
  title: "Návrhy otevírání menu",
  robots: { index: false, follow: false },
};

const NAVRHY = [
  {
    href: "/navrh/menu/v1",
    nazev: "1 · Kniha s tloušťkou",
    popis: "CSS 3D kniha: deska s hranami a blokem listů se nadzvedne, přetočí přes hřbet s odleskem a dosedne s překmitem.",
  },
  {
    href: "/navrh/menu/v2",
    nazev: "2 · Trojdílná skládačka",
    popis: "Menu uprostřed, obálka se odklopí doprava, úvodní křídlo doleva; na telefonu svisle.",
  },
  {
    href: "/navrh/menu/v3",
    nazev: "3 · Karty v kapse",
    popis: "Karty se vytáhnou z papírové kapsy a rozloží vedle sebe (motion); na telefonu se míchají.",
  },
  {
    href: "/navrh/menu/v4",
    nazev: "4 · Kniha ve WebGL",
    popis: "Kniha 1 jako skutečný 3D objekt (three.js): tloušťka, hřbet, zlatá ražba ve světle, stíny a svatební květiny na stole.",
  },
  {
    href: "/navrh/menu/v5",
    nazev: "5 · Kniha a 3D prstýnky",
    popis: "DOM kniha z návrhu 1 a vedle ní na stole zlaté prstýnky ve WebGL — stejné zlato jako prsten v úvodu webu.",
  },
];

export default function Navrhy() {
  return (
    <main className={s.stranka}>
      <header className={s.hlava}>
        <Link href="/navrh" className={s.zpet}>← Návrhy</Link>
        <h1 className={s.nazev}>
          <span className={s.cislo}>Svatební menu</span> Návrhy otevírání
        </h1>
      </header>
      <ul className={s.seznam}>
        {NAVRHY.map((n) => (
          <li key={n.href}>
            <Link href={n.href} className={s.polozka}>
              <span className={s.polozkaNazev}>{n.nazev}</span>
              <span className={s.polozkaPopis}>{n.popis}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
