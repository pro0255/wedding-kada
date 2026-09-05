import type { Metadata } from "next";
import Link from "next/link";
import FotoGalerie from "../FotoGalerie";
import VyberHry from "../hry/VyberHry";
import s from "./podekovani.module.css";

export const metadata: Metadata = {
  title: "Děkujeme — Kateřina & Jakub",
  description: "Bylo to krásné. Díky, že jste byli u toho.",
};

/** Web po svatbě: poděkování, fotky od hostů a hry jako památka.
    Hlavní stránka sem přesměrovává od rána po svatbě (proxy.ts). */
export default function Podekovani() {
  return (
    <main className={s.stranka}>
      <section className="hero-full">
        <img className="hero-bg" src="/fotky/kaplicka.jpg" alt="Kaplička" />
        <div className="hero-content in">
          <p className="hero-eyebrow">Bylo to krásné</p>
          <h1 className="hero-title">Děkujeme</h1>
          <div className="hero-date">18 · 09 · 2027</div>
        </div>
      </section>

      <section className={s.text}>
        <div className="wrap">
          <p className="eyebrow">Kateřina &amp; Jakub</p>
          <h2>Díky, že jste byli u toho</h2>
          <p className="lead">
            Za každé objetí, každý tanec, každou slzu i každou skleničku. Bez vás by to byl
            jen hezký den — s vámi to byl ten nejlepší. Fotky, které jste nafotili, jsou tady
            všechny pohromadě. Dívejte se, stahujte, rozdávejte srdíčka.
          </p>
        </div>
      </section>

      <section className={`galerie ${s.galerie}`}>
        <div className="wrap">
          <p className="eyebrow">Vzpomínky</p>
          <h2>Fotky od vás</h2>
        </div>
        <FotoGalerie />
      </section>

      <section className={s.hry}>
        <div className="wrap">
          <p className="eyebrow">Na památku</p>
          <h2>Svatební hry</h2>
          <p className="lead">Žebříčky zůstávají. Rekordy se dají překonat i po svatbě.</p>
        </div>
        <div className={s.karty}>
          <VyberHry />
        </div>
      </section>

      <footer className={s.paticka}>
        <p className="serif">Kateřina &amp; Jakub</p>
        <Link href="/?svatba=1">Původní svatební web</Link>
      </footer>
    </main>
  );
}
