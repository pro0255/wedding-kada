"use client";

import { useEffect, useRef, useState } from "react";
import { Parisienne } from "next/font/google";
import s from "./oznameni.module.css";

/* Svatební oznámení k tisku — sada pěti karet.

   Stavěné jako TISKOVINA, ne jako stránka, která se dá vytisknout. Každá karta
   je o 3 mm větší na každou stranu, než jak se ořízne (spad), aby po ořezu
   nezůstal na kraji bílý proužek, když se papír v řezačce posune. Text proto
   nesmí ke kraji — drží se v bezpečné zóně.

   Tiskne se po JEDNÉ kartě: @page umí jen jeden rozměr na celý dokument,
   takže se velikost stránky přepíná podle vybrané karty. Víc formátů najednou
   by prohlížeč zmenšil na jeden a spad by přestal sedět na milimetr.

   Fotky na pásku jsou černobílé už v souboru (scripts/pasek-fotek.mjs), ne přes
   CSS filtr — filtrovaný obrázek prohlížeč při tisku rasterizuje v rozlišení,
   které si zvolí sám, a to u tiskoviny nechci hádat.

   Kytky kolem textu vyřezává scripts/kyticky-oznameni.mjs z archu, který dodala
   Káťa. Každá snítka je vlastní soubor, aby se daly rozházet po kartě jednotlivě
   a v různých velikostech a natočeních. Rozmístění je psané ručně v KYTKY —
   náhoda dělá shluky a prázdná místa, tohle má být rovnoměrný věnec. */

/* Kaligrafie na jména a na „Děkujeme“. Web žádné takové písmo nemá, Caveat je
   fixa, ne kaligrafie. latin-ext kvůli české diakritice. */
const kaligrafie = Parisienne({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--kaligrafie",
});

const SPAD = 3;   // přesah přes ořez na každou stranu, v mm

type KartaKlic = "hlavni" | "info" | "pasek" | "obrad" | "vizitka";

const KARTY: { klic: KartaKlic; nazev: string; sirka: number; vyska: number; zona: number }[] = [
  { klic: "hlavni", nazev: "Hlavní (A5)", sirka: 148, vyska: 210, zona: 10 },
  /* Informační karta je široká jako A6, ale vyšší. Na 148 mm výšky se text
     nevešel — přetékal o 23 mm a stlačit ho šlo jen na písmo kolem šesti bodů,
     což se na papíře čte mizerně. Šířka zůstala, aby seděly řádky i řada
     kuliček; přibyla jen výška.

     Výška je odměřená na text, ne na formát: obsah má 160 mm, plocha uvnitř
     bezpečné zóny 168. Při 210 mm zbývalo 27 mm, a protože je text vystředěný,
     visela půlka toho vzduchu nad nadpisem. */
  { klic: "info", nazev: "Informace (105 × 190)", sirka: 105, vyska: 190, zona: 8 },
  /* Arch proužků s fotkami. Proužky jsou samostatné, přikládají se ke kartě —
     ale tisknou se po třech na jednu A5 a řežou se z ní. Proto je karta A5
     a ne proužek: jeden tisk, dva řezy. Bezpečná zóna je nulová, protože
     obsah má sahat až k ořezu a dělí se přesně na třetiny. */
  { klic: "pasek", nazev: "Pásky s fotkami (A5)", sirka: 148, vyska: 210, zona: 0 },
  { klic: "obrad", nazev: "Pozvánka na obřad", sirka: 90, vyska: 50, zona: 6 },
  { klic: "vizitka", nazev: "Pozvánka ke stolu", sirka: 90, vyska: 50, zona: 6 },
];

/* Kolik snítek vyrobil scripts/kyticky-oznameni.mjs. Soubory jsou 01..NN. */
const SNITEK = 34;

/* Deterministická náhoda ze souřadnic buňky. Math.random tu být nesmí: server
   a klient by vykreslily jinou kartu a React by na tom spadl. Sinusový hash
   dává pokaždé stejné číslo a přitom to nevypadá pravidelně. */
function sum(a: number, b: number) {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

type Zona = { x1: number; y1: number; x2: number; y2: number };
type Kytka = { snitka: string; x: number; y: number; v: number; uhel: number };

/* Rozsyp snítek po kartě.

   Karta se rozdělí na stejně velké buňky a do každé padne jedna kytka,
   posunutá uvnitř buňky o kus stranou. Rozestupy jsou tím pádem všude zhruba
   stejné — ručně skládaný rozsyp dělal dvojice nalepené na sobě a vedle nich
   prázdno. Velikost a natočení se střídají, aby to nevypadalo jako tapeta.

   Buňky, které by zasáhly do textu, vypadnou. Kytky proto nejsou jen po
   obvodu: kde je mezi odstavci volno, prostrčí se i doprostřed karty.

   Souřadnice jsou v milimetrech od rohu karty VČETNĚ spadu — kytky u kraje
   mají po ořezu vybíhat ven, jako na předloze. */
function rozsyp(
  sirka: number, vyska: number,
  sloupcu: number, radku: number,
  zony: Zona[],
  /* Rozsah výšky snítek. Na malé pozvánce musí být drobnější — dvaadvacet
     milimetrů je na kartě vysoké padesát skoro polovina výšky. */
  nejmensi = 13, nejvetsi = 22,
): Kytka[] {
  const bunkaX = sirka / sloupcu;
  const bunkaY = vyska / radku;
  const kytky: Kytka[] = [];
  let poradi = 0;

  for (let r = 0; r < radku; r++) {
    for (let c = 0; c < sloupcu; c++) {
      const v = nejmensi + sum(c, r) * (nejvetsi - nejmensi);
      const sirkaKytky = v * 0.55;      // snítky jsou zhruba 1 : 1,8
      const x = c * bunkaX + (bunkaX - sirkaKytky) * (0.15 + sum(c + 10, r) * 0.7);
      const y = r * bunkaY + (bunkaY - v) * (0.15 + sum(c, r + 10) * 0.7);

      const zasahujeText = zony.some((z) =>
        x < z.x2 && x + sirkaKytky > z.x1 && y < z.y2 && y + v > z.y1);
      if (zasahujeText) continue;

      /* Krok sedmi místo pořadí: sousední buňky tak nedostanou sousední
         snítky a stejná kytka se nesejde sama se sebou. Sedmička je nesoudělná
         s 34, takže se vystřídají všechny. */
      /* Zaokrouhleno na setiny milimetru. Nezaokrouhlené číslo jde do inline
         stylu s patnácti ciframi, server a klient ho vypíšou každý jinak
         a React na tom ohlásí neshodu hydratace — a tiskárna z desetitisícin
         milimetru stejně nic nemá. */
      const nadva = (n: number) => Math.round(n * 100) / 100;
      kytky.push({
        snitka: String(((poradi * 7) % SNITEK) + 1).padStart(2, "0"),
        x: nadva(x), y: nadva(y), v: nadva(v),
        uhel: Math.round(-22 + sum(c + 20, r + 20) * 44),
      });
      poradi++;
    }
  }
  return kytky;
}

/* Místa, kam kytky nesmí. Odměřené z hotové karty a o 3 mm rozšířené, ať se
   nedotýkají písmen. */
const KYTKY = rozsyp(154, 216, 6, 9, [
  { x1: 61, y1: 26, x2: 93, y2: 42 },      // ty a já, teď a navždy
  { x1: 40, y1: 60, x2: 114, y2: 103 },    // jména
  { x1: 57, y1: 106, x2: 97, y2: 119 },    // si řeknou své ano
  { x1: 54, y1: 132, x2: 100, y2: 180 },   // datum a místo
]);

/* Čtyři řady schválně: text zabírá 21 mm z padesáti šesti, takže při třech
   řadách zasahoval do každé a kytky zbyly jen po stranách. Se čtyřmi je horní
   i spodní pruh volný celý. */
const KYTKY_MALE = rozsyp(96, 56, 5, 4, [
  { x1: 15, y1: 17.5, x2: 81, y2: 38.5 },
], 8, 13);

/* Vzorník pastelů k dress code. Stejné odstíny jako kuličky na webu
   (DOTAZY v app/page.tsx) — je to jedna svatba, tak i jeden vzorník.
   Vlastní typ kvůli tomu, že barvy má jen jeden blok ze dvou. */
type InfoBlok = {
  nadpis: string;
  text: string;
  adresa?: string;
  poznamka?: string;
  barvy?: string[];
};

const BLOKY: InfoBlok[] = [
  {
    nadpis: "Místo konání",
    text:
      "Milí svatebčané, celý náš svatební den včetně obřadu se bude konat v krásném lesním hotelu Rekovice.",
    /* Bez názvu hotelu — ten je o větu výš, dvakrát ho tam nikdo nepotřebuje. */
    adresa: "Trojanovice 2, 744 01 Trojanovice",
    poznamka: "Doražte na obřad prosím s předstihem a dejte nám vědět, že dorazíte.",
  },
  {
    nadpis: "Svatební dary",
    text:
      "Největší dar je pro nás to, že s námi ten den strávíte. Kdybyste nám přesto chtěli něco věnovat, nejradši uvítáme příspěvek do naší společné budoucnosti — obálku nám můžete předat kdykoliv během dne. A jestli radši nosíte něco hmatatelného: místo kytice rádi odvezeme granule, deky nebo hračky do útulku.",
  },
  {
    nadpis: "Dress code",
    text:
      "Svatba bude v pastelových barvách. Sladit se s nimi je milé gesto, ne povinnost.",
    barvy: ["#c3d7ec", "#f6c396", "#f5a3a8", "#f4d3d9", "#a8c8ec", "#f8e4a3", "#b7d3ab"],
  },
];

/* Všechny texty na jednom místě, ať se ladí bez hledání v JSX.

   Texty informační karty jsou schválně krátké. Delší verze se na A6 nevešla
   a musela by se stlačit na písmo o velikosti asi šesti bodů, což se na papíře
   čte špatně — na tiskovině je jednodušší ubrat slova než body. */
const T = {
  hlavni: {
    /* „navždy“ je psacím písmem uprostřed řádku kapitálek, proto zvlášť. */
    uvod: { prvni: "ty a já,", druhy: "teď a ", psaci: "navždy" },
    nevesta: "Kateřina",
    zenich: "Jakub",
    spojka: "a",
    slib: "si řeknou své „ano“",
    datum: "18. 9. 2027",
    detail: ["ve 12 hodin", "u zvoničky", "v Rekovicích"],
  },
  info: {
    bloky: BLOKY,
    podpis: "Děkujeme,",
    zaver: "že budete součástí našeho velkého dne.",
  },
  obrad: {
    uvod: "srdečně vás zveme",
    hlavni: "na svatební obřad",
  },
  vizitka: {
    uvod: "srdečně vás zveme",
    hlavni: "ke svatebnímu stolu",
  },
};

export default function Oznameni() {
  const obal = useRef<HTMLDivElement>(null);
  const [skala, setSkala] = useState(1);
  const [klic, setKlic] = useState<KartaKlic>("hlavni");
  const [ukazVoditka, setUkazVoditka] = useState(true);

  const karta = KARTY.find((k) => k.klic === klic)!;
  const spadSirka = karta.sirka + SPAD * 2;
  const spadVyska = karta.vyska + SPAD * 2;

  /* Na úzké obrazovce se karta zmenší, aby se vešla; ladí se ale v 1:1.
     Transform nezmenší místo v toku, výšku proto drží obal přes --skala. */
  useEffect(() => {
    const el = obal.current;
    if (!el) return;
    const sirkaPx = (spadSirka / 25.4) * 96;
    const zmer = () => setSkala(Math.min(1, el.clientWidth / sirkaPx));
    zmer();
    const ro = new ResizeObserver(zmer);
    ro.observe(el);
    return () => ro.disconnect();
  }, [spadSirka]);

  return (
    <main className={`${s.stranka} ${kaligrafie.variable}`}>
      {/* Rozměr tiskové stránky se mění podle vybrané karty. Musí to být
          skutečný <style>, protože @page se nedá nastavit inline stylem. */}
      <style>{`@page { size: ${spadSirka}mm ${spadVyska}mm; margin: 0; }`}</style>

      <div className={s.lista}>
        <div className={s.listaInfo}>
          <strong>Svatební oznámení</strong>
          <span className={s.napoveda}>
            {karta.nazev}: ořez {karta.sirka} × {karta.vyska} mm, se spadem{" "}
            {spadSirka} × {spadVyska} mm. Tiskne se po jedné kartě — v dialogu
            zvolte „Uložit jako PDF“, okraje „Žádné“ a zapněte grafiku pozadí.
          </span>
        </div>

        <div className={s.prepinac} role="group" aria-label="Která karta">
          {KARTY.map((k) => (
            <button
              key={k.klic}
              type="button"
              className={`${s.volba} ${klic === k.klic ? s.volbaAktivni : ""}`}
              aria-pressed={klic === k.klic}
              onClick={() => setKlic(k.klic)}
            >
              {k.nazev}
            </button>
          ))}
        </div>

        <label className={s.prepinacVoditka}>
          <input type="checkbox" checked={ukazVoditka} onChange={(e) => setUkazVoditka(e.target.checked)} />
          Vodítka řezu
        </label>

        <button type="button" className={s.tlacitko} onClick={() => window.print()}>
          Exportovat do PDF
        </button>
      </div>

      <div
        className={s.obal}
        ref={obal}
        style={
          {
            "--skala": skala,
            "--karta-sirka": `${spadSirka}mm`,
            "--karta-vyska": `${spadVyska}mm`,
            "--spad": `${SPAD}mm`,
            "--zona": `${karta.zona}mm`,
          } as React.CSSProperties
        }
      >
        <section className={`${s.karta} ${s[`k-${klic}`]}`} aria-label={`Karta: ${karta.nazev}`}>
          {/* Kytky leží pod textem a smí zasahovat až do spadu — po ořezu se
              některé nakousnou, přesně jak to má předloha. */}
          {(klic === "hlavni" ? KYTKY
            : klic === "info" || klic === "pasek" ? []
            : KYTKY_MALE
          ).map((k, i) => (
            <img
              key={i}
              className={s.kytka}
              src={`/oznameni/kyticky/${k.snitka}.png`}
              alt=""
              aria-hidden="true"
              style={{ left: `${k.x}mm`, top: `${k.y}mm`, height: `${k.v}mm`, rotate: `${k.uhel}deg` }}
            />
          ))}

          <div className={s.text}>
            {klic === "hlavni" && <Hlavni />}
            {klic === "info" && <Info />}
            {klic === "pasek" && <Pasek voditka={ukazVoditka} />}
            {klic === "obrad" && <Zvani {...T.obrad} />}
            {klic === "vizitka" && <Zvani {...T.vizitka} />}
          </div>

          {/* Vodítka jen na obrazovce: červená je řez, modrá bezpečná zóna.
              V tisku se skryjí, aby nešla do PDF pro tiskárnu. */}
          {ukazVoditka && (
            <>
              <i className={s.rez} aria-hidden="true" />
              <i className={s.zona} aria-hidden="true" />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Hlavni() {
  const t = T.hlavni;
  return (
    <>
      <p className={s.uvod}>
        {t.uvod.prvni}
        <br />
        {t.uvod.druhy}
        <span className={s.psaci}>{t.uvod.psaci}</span>
      </p>

      <div className={s.jmena}>
        <p className={s.jmeno}>{t.nevesta}</p>
        <p className={s.spojka}>{t.spojka}</p>
        <p className={s.jmeno}>{t.zenich}</p>
      </div>

      <p className={s.slib}>{t.slib}</p>

      {/* Datum a místo jsou na předloze jeden blok na střed, ne pokračování
          zarovnání jmen doleva. */}
      <div className={s.udaje}>
        <p className={s.datum}>{t.datum}</p>
        <p className={s.detail}>
          {t.detail.map((r) => (
            <span key={r}>{r}</span>
          ))}
        </p>
      </div>
    </>
  );
}

function Info() {
  const t = T.info;
  return (
    <>
      {t.bloky.map((b) => (
        <section key={b.nadpis} className={s.infoBlok}>
          <h2 className={s.infoNadpis}>{b.nadpis}</h2>
          <p className={s.infoText}>{b.text}</p>
          {b.adresa && <p className={s.infoAdresa}>{b.adresa}</p>}
          {b.poznamka && <p className={s.infoPoznamka}>{b.poznamka}</p>}
          {b.barvy && (
            <ul className={s.barvy}>
              {/* Názvy odstínů tu nejsou schválně — na papíře je vedle sebe
                  nikdo neluští a čtečka obrazovky se sem nedostane. */}
              {b.barvy.map((h) => (
                <li key={h} className={s.kulicka} style={{ background: h }} />
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className={s.podpis}>{t.podpis}</p>
      <p className={s.infoZaver}>{t.zaver}</p>
    </>
  );
}

/* Arch se třemi proužky vedle sebe. Každý proužek je třetina šířky A5, tedy
   49,33 mm, a je vysoký přes celou stránku — po vytisknutí stačí dva svislé
   řezy a jsou z toho tři pásky.

   Všechny tři jsou stejné, ne tři různé sady fotek: jde o to mít víc kusů
   téhož pásku, ne tři varianty.

   Rozestupy mezi fotkami dělá space-between, takže sedí i po změně rozměru
   fotek — stačí přegenerovat scripts/pasek-fotek.mjs a nesahat na styly. */
function Pasek({ voditka }: { voditka: boolean }) {
  return (
    <div className={s.pasekArch}>
      {[0, 1, 2].map((proužek) => (
        <div key={proužek} className={s.pasekProuzek}>
          {[1, 2, 3].map((n) => (
            <img
              key={n}
              className={s.pasekFotka}
              src={`/oznameni/pasek/${n}.jpg`}
              alt=""
              aria-hidden="true"
            />
          ))}
        </div>
      ))}

      {/* Kudy řezat. Jen na obrazovce — do PDF pro tiskárnu nesmí. */}
      {voditka && [1, 2].map((i) => (
        <i key={i} className={s.pasekRez} style={{ left: `${(i * 100) / 3}%` }} aria-hidden="true" />
      ))}
    </div>
  );
}

/* Obě malé pozvánky — ke stolu i na obřad. Liší se jen textem, tak ať se
   neduplikuje rozvržení. */
function Zvani({ uvod, hlavni, detail }: { uvod: string; hlavni: string; detail?: string }) {
  return (
    <>
      <p className={s.vizitkaUvod}>{uvod}</p>
      <p className={s.vizitkaHlavni}>{hlavni}</p>
      {detail && <p className={s.vizitkaDetail}>{detail}</p>}
    </>
  );
}
