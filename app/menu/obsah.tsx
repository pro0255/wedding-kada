import { memo } from "react";
import s from "./papir.module.css";

/* Obsah svatebního menu: strany knihy a líc desek.

   Komponenty jsou v memo(): při otevření se mění jen třídy a atributy
   obalu, strany samotné se nepřekreslují. Bez toho React při každém
   klepnutí znovu sestavoval stovky prvků a na pomalém telefonu to byl
   snímek přes 40 ms — cuknutí hned na začátku animace. */

type Chod = { kurz: string; jidlo: string; detail: string };

const DOSPELI: Chod[] = [
  { kurz: "Polévka", jidlo: "Svatební vývar", detail: "Játrové knedlíčky, zelenina, nudle" },
  { kurz: "Hlavní chod", jidlo: "Vepřová panenka sous-vide", detail: "Pečené brambory grenaille, pepřová omáčka" },
  { kurz: "Dezert", jidlo: "Svatební dort", detail: "Čokoládový korpus, pařížský krém, malinový kompot" },
];

const DETI: Chod[] = [
  { kurz: "Polévka", jidlo: "Svatební vývar", detail: "Zelenina, nudle" },
  { kurz: "Hlavní chod", jidlo: "Smažený kuřecí řízek", detail: "Bramborové pyré" },
  { kurz: "Dezert", jidlo: "Svatební dort", detail: "Čokoládový korpus, pařížský krém" },
];

const UVOD =
  "To nejlepší z kuchyně. Klidně si nalžeme, že jste se nejvíc těšili na obřad — my víme svoje.";

const ALERGENY =
  "Speciální stravovací požadavky (vegetariánské, veganské či zdravotní) nám prosím napište nejpozději do 1. 8. 2027.";

function Chody({ chody }: { chody: Chod[] }) {
  return (
    <ul className={s.chody}>
      {chody.map((c) => (
        <li key={c.kurz}>
          <span className={s.kurz}>{c.kurz}</span>
          <span className={s.jidlo}>{c.jidlo}</span>
          <span className={s.detail}>{c.detail}</span>
        </li>
      ))}
    </ul>
  );
}

/** Drobná zlatá ozdoba — kosočtverec mezi dvěma linkami. */
const Ornament = memo(function Ornament() {
  return (
    <svg className={s.ornament} viewBox="0 0 120 12" aria-hidden="true">
      <line x1="0" y1="6" x2="50" y2="6" />
      <path d="M60 1 L65 6 L60 11 L55 6 Z" />
      <line x1="70" y1="6" x2="120" y2="6" />
    </svg>
  );
});

/** Menu pro dospělé s vtipem pod nadpisem a poznámkou o stravování. */
export const StranaDospeli = memo(function StranaDospeli() {
  return (
    <div className={s.papir}>
      <div className={s.obsah}>
        <h3 className={s.nadstrana}>Menu</h3>
        <Ornament />
        <p className={s.uvod}>{UVOD}</p>
        <Chody chody={DOSPELI} />
        <p className={s.alergeny}>{ALERGENY}</p>
      </div>
    </div>
  );
});

export const StranaDeti = memo(function StranaDeti() {
  return (
    <div className={s.papir}>
      <div className={s.obsah}>
        <h3 className={s.nadstrana}>Pro naše nejmenší</h3>
        <Ornament />
        <Chody chody={DETI} />
        <p className={s.preji}>Dobrou chuť</p>
      </div>
    </div>
  );
});

/** Líc desek: zlatá ražba na hladkém papíře. */
export const Lic = memo(function Lic() {
  return (
    <span className={s.lic}>
      <span className={s.licRamecek} aria-hidden="true" />
      <span className={s.licNazev}>Menu</span>
      <Ornament />
      <span className={s.licMonogram}>K &amp; J</span>
      <span className={s.licDatum}>18 · 09 · 2027</span>
    </span>
  );
});
