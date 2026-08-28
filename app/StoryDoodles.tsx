"use client";

/* Ručně psané doodly u „Náš příběh“ — šipka „klikni“ pod hromádkou fotek,
   šipka „zásnuby na Troskách“ nad fotkou z Trosek a srdíčko s iniciálami
   a datem v rohu.

   Kreslí se stejnou technikou jako scénky u programu dne: každá čára má
   pathLength=1 a vyjede z mezery dash vzoru, takže se doodle „dopíše“ sám
   (viz .story-doodle v globals.css). Nápisy sází Caveat (--rukopis), aby
   vypadaly opravdu psané rukou, a naskočí až po dokreslení čar.

   Souřadnice jsou v jednotkách viewBoxu — velikost a poloha se řídí v CSS
   přes obal .doodle-obal-*, ne tady. */

const T = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  pathLength: 1,
};

/* společné vlastnosti nápisů — Caveat s fallbackem, ať to nikde nespadne do patky */
const PISMO = {
  className: "doodle-napis",
  fontFamily: "var(--rukopis), \"Segoe Script\", cursive",
  fontWeight: 600,
};

/* „klikni“ + šipka stáčející se vzhůru doprava — sedí pod hromádkou fotek
   a míří špičkou zpět do fotky */
export function SipkaKlikni() {
  return (
    <svg className="story-doodle doodle-klikni" viewBox="0 0 220 150" aria-hidden="true" focusable="false">
      <text {...PISMO} x="2" y="132" fontSize="46">klikni</text>
      <path {...T} d="M 130 116 C 160 108, 178 90, 187 46" />
      <path {...T} className="doodle-hrot" d="M 187 46 L 171 63" />
      <path {...T} className="doodle-hrot" d="M 187 46 L 196 66" />
    </svg>
  );
}

/* „zásnuby na Troskách“ + šipka dolů doleva — visí nad hromádkou a ukazuje
   na fotku z Trosek, tak se zobrazuje jen když je zrovna navrchu.
   Nápis je na dvě řádky, druhá menší jako dopsaná dovětkem; šipka je proto
   o 40 jednotek níž než dřív (viewBox povyrostl ze 130 na 170) a obal se
   v CSS o tolik nadzvedl, ať špička míří pořád na stejné místo. */
export function SipkaZasnuby() {
  return (
    <svg className="story-doodle doodle-zasnuby" viewBox="0 0 220 170" aria-hidden="true" focusable="false">
      <text {...PISMO} x="48" y="44" fontSize="46">zásnuby</text>
      <text {...PISMO} x="48" y="84" fontSize="36">na Troskách</text>
      <path {...T} d="M 66 102 C 47 118, 36 133, 27 153" />
      <path {...T} className="doodle-hrot" d="M 27 153 L 32 131" />
      <path {...T} className="doodle-hrot" d="M 27 153 L 49 146" />
    </svg>
  );
}

/* „první společná fotka“ + stejná šipka jako u zásnub — patří k zimní fotce
   z hor, tedy druhé v hromádce. Sedí ve stejném rohu jako zásnuby; vidět je
   vždycky jen jedna z nich, podle toho, která fotka je zrovna navrchu. */
export function SipkaPrvniFotka() {
  return (
    <svg className="story-doodle doodle-prvni-fotka" viewBox="0 0 220 170" aria-hidden="true" focusable="false">
      <text {...PISMO} x="22" y="44" fontSize="46">první</text>
      <text {...PISMO} x="22" y="84" fontSize="34">společná fotka</text>
      <path {...T} d="M 66 102 C 47 118, 36 133, 27 153" />
      <path {...T} className="doodle-hrot" d="M 27 153 L 32 131" />
      <path {...T} className="doodle-hrot" d="M 27 153 L 49 146" />
    </svg>
  );
}

/* srdce probodnuté šípem, uvnitř iniciály a datum zásnub.
   Dřevec je rozdělený na dva kusy — vlevo z něj vyčnívá hrot, vpravo opeřený
   konec; prostředek „schovaný uvnitř“ se nekreslí, aby čára nešla přes srdce.
   Obě části jsou výřezy z jedné a téže křivky, takže na sebe navazují.
   Hrot míří doleva, tedy do středu stránky — doodle visí u pravého okraje. */
export function SrdceIniciraly() {
  return (
    <svg className="story-doodle doodle-srdce" viewBox="0 0 220 218" aria-hidden="true" focusable="false">
      <path
        {...T}
        d="M 110 174 C 96 161, 34 123, 34 85 C 34 60, 57 45, 77 54 C 91 60, 103 73, 110 89 C 117 73, 129 60, 143 54 C 163 45, 186 60, 186 85 C 186 123, 124 161, 110 174 Z"
      />
      <path {...T} className="doodle-sip" d="M 10 119 C 18.6 117, 29.5 114.1, 42 110" />
      <path {...T} className="doodle-sip" d="M 175.8 59.9 C 187.5 54.5, 199.9 48.9, 208 45" />
      {/* hrot vlevo */}
      <path {...T} className="doodle-sip doodle-hrot" d="M 10 119 L 28.7 122.5" />
      <path {...T} className="doodle-sip doodle-hrot" d="M 10 119 L 21.3 103.7" />
      {/* Opeření vpravo — tři štětiny kolmo napříč dřevcem, o 7 jednotek na
         každou stranu. Dřív šly našikmo a vypadaly jako anténa. Střed každé
         sedí na dřevci, směr je kolmý na jeho sklon, tedy (−0,418, −0,908). */}
      <path {...T} className="doodle-sip doodle-hrot" d="M 186.9 47.1 L 192.7 59.9" />
      <path {...T} className="doodle-sip doodle-hrot" d="M 193.7 44 L 199.5 56.8" />
      <path {...T} className="doodle-sip doodle-hrot" d="M 200.1 41 L 205.9 53.8" />
      {/* Nápis sedí v nejširší části srdce. Výš už zasahuje zářez mezi laloky
         (nejnižší bod je 110, 89), níž se srdce rychle zužuje — proto je
         datum menší a obě řádky vyjdou skoro na stejnou šířku.

         Text se naklání spolu se srdcem — dřív ho tu vyrovnávala protirotace
         +7°, která rušila rotate(-7deg) obalu .doodle-obal-srdce. Bez ní má
         nápis stejný lehký sklon doleva jako srdce kolem něj.

         Iniciály jsou tři samostatné texty, ne jeden řetězec: „K“ a „J“ nejsou
         stejně široké, takže textAnchor="middle" přes celé „K + J“ posadil
         plus vedle osy srdce. Takhle plus na ose (x=110) opravdu sedí.

         Velikost 42, ne 54 — ve 54 se iniciály roztahovaly skoro přes celou
         šířku srdce a konce písmen lezly ven z obrysu. */}
      {/* Kotvy nejsou symetrické kolem 110: Caveat má u „K“ výrazný přesah
         doprava a plus posazené vedle své šířky, takže se rovnalo podle
         skutečných obrysů písmen, ne podle jejich kotev. */}
      <text {...PISMO} x="85" y="116" fontSize="42" textAnchor="end">K</text>
      <text {...PISMO} x="108.7" y="116" fontSize="42" textAnchor="middle">+</text>
      <text {...PISMO} x="130" y="116" fontSize="42" textAnchor="start">J</text>
      <text {...PISMO} x="109" y="136" fontSize="20" textAnchor="middle" className="doodle-napis doodle-datum">
        30. 7. 2026
      </text>
    </svg>
  );
}
