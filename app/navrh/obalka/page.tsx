import type { Metadata } from "next";
import Link from "next/link";
import s from "./index.module.css";

export const metadata: Metadata = { title: "Návrhy obálky — Náš příběh", robots: { index: false } };

const VERZE = [
  {
    href: "/navrh/obalka/v1",
    nazev: "V1 — skutečný 3D model (three.js)",
    popis:
      "CC0 model obálky rozříznutý na tělo a chlopeň na pantu, měkké stíny, pečeť se rozlomí, přeložený dopis vyjede a rozloží se; snítka v rohu je ve 3D a vrhá stín. Nejvěrnější prostor, nejtěžší (three.js ~150 kB gzip, líně).",
  },
  {
    href: "/navrh/obalka/v2",
    nazev: "V2 — čisté CSS 3D",
    popis:
      "Chlopeň na pantu (rotateX) s podšívkou, pečeť se rozlomí, přeložený dopis vyjede a rozloží se. Bez JS animací, jen transform/opacity — nejlehčí a nejostřejší.",
  },
  {
    href: "/navrh/obalka/v3",
    nazev: "V3 — dopis poštou (GSAP)",
    popis:
      "Obálka leží adresou nahoru (známka s fotkou, razítko Rekovice); klepnutí ji otočí na rub, pečeť praskne se zlatými jiskrami, chlopeň se otevře a dopis vyjede. Myš ji naklání.",
  },
];

export default function Page() {
  return (
    <main className={s.stranka}>
      <Link href="/navrh" className={s.zpet}>
        ← všechny návrhy webu
      </Link>
      <h1 className={s.nadpis}>Obálka „Náš příběh“ — návrhy</h1>
      <p className={s.uvod}>
        Kompozice D1: polaroidy vlevo, obálka vpravo dole přes jejich roh (+4°), kolem skutečné
        svatební květiny. Klepnutí obálku otevře, druhé zavře.
      </p>
      <ul className={s.seznam}>
        {VERZE.map((v) => (
          <li key={v.href}>
            <Link href={v.href} className={s.karta}>
              <span className={s.kartaNazev}>{v.nazev}</span>
              <span className={s.kartaPopis}>{v.popis}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p className={s.zdroje}>
        Zdroje: model obálky „Envelope“ — reyshapes, Poly Pizza, CC0 (poly.pizza/m/M9mVmRXHif) ·
        textura papíru Paper002 — ambientCG, CC0 · GSAP — gsap.com, zdarma (GSAP Standard License).
      </p>
    </main>
  );
}
