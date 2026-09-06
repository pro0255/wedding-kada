"use client";

import { useEffect, useRef, useState } from "react";
import { Parisienne } from "next/font/google";
import s from "./oznameni.module.css";

/* Svatební oznámení k tisku — sada tří karet.

   Stavěné jako TISKOVINA, ne jako stránka, která se dá vytisknout. Každá karta
   je o 3 mm větší na každou stranu, než jak se ořízne (spad), aby po ořezu
   nezůstal na kraji bílý proužek, když se papír v řezačce posune. Text proto
   nesmí ke kraji — drží se v bezpečné zóně.

   Tiskne se po JEDNÉ kartě: @page umí jen jeden rozměr na celý dokument,
   takže se velikost stránky přepíná podle vybrané karty. Tři formáty najednou
   by prohlížeč zmenšil na jeden a spad by přestal sedět na milimetr.

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

type KartaKlic = "hlavni" | "info" | "vizitka";

const KARTY: { klic: KartaKlic; nazev: string; sirka: number; vyska: number; zona: number }[] = [
  { klic: "hlavni", nazev: "Hlavní (A5)", sirka: 148, vyska: 210, zona: 10 },
  { klic: "info", nazev: "Informace (A6)", sirka: 105, vyska: 148, zona: 8 },
  { klic: "vizitka", nazev: "Pozvánka ke stolu", sirka: 90, vyska: 50, zona: 6 },
];

/* Rozmístění snítek na hlavní kartě. Souřadnice jsou v milimetrech od rohu
   karty VČETNĚ spadu (154 x 216 mm), ne od ořezu — kytky u kraje mají vybíhat
   ven a po ořezu se nakousnout, jako na předloze.

   x, y = levý horní roh, v = výška (šířka dopočítá poměr stran), uhel = natočení.
   Je to psané ručně, ne náhodně: náhoda dělá shluky a holá místa, tohle má být
   pravidelný věnec kolem textu. Střed karty zůstává prázdný, text je tam. */
const KYTKY = [
  // horní pás
  { snitka: "03", x: 22, y: 6, v: 22, uhel: -12 },
  { snitka: "09", x: 52, y: 2, v: 18, uhel: 15 },
  { snitka: "22", x: 84, y: 5, v: 20, uhel: -6 },
  { snitka: "05", x: 112, y: 2, v: 19, uhel: 20 },
  { snitka: "13", x: 132, y: 12, v: 21, uhel: -16 },
  // levý sloupec
  { snitka: "07", x: 6, y: 32, v: 26, uhel: 8 },
  { snitka: "11", x: 12, y: 64, v: 22, uhel: -10 },
  { snitka: "19", x: 6, y: 96, v: 22, uhel: 12 },
  { snitka: "01", x: 10, y: 128, v: 24, uhel: -18 },
  { snitka: "32", x: 4, y: 162, v: 16, uhel: 6 },
  // pravý sloupec
  { snitka: "16", x: 126, y: 42, v: 22, uhel: -14 },
  { snitka: "10", x: 134, y: 72, v: 20, uhel: 10 },
  { snitka: "24", x: 124, y: 102, v: 22, uhel: -8 },
  { snitka: "12", x: 132, y: 134, v: 22, uhel: 16 },
  { snitka: "21", x: 122, y: 164, v: 20, uhel: -12 },
  // dolní pás
  { snitka: "02", x: 26, y: 184, v: 24, uhel: 10 },
  { snitka: "15", x: 58, y: 194, v: 18, uhel: -14 },
  { snitka: "31", x: 86, y: 188, v: 20, uhel: 18 },
  { snitka: "26", x: 112, y: 192, v: 20, uhel: -8 },
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
    datum: "18. 9. 2027",
    detail: ["ve 12 hodin", "u zvoničky", "v Rekovicích"],
  },
  info: {
    uvodni:
      "Obřad, oběd i večerní párty se konají na jednom místě. Sejdeme se ve dvanáct u zvoničky, od tří hodin vás dva řidiči odvezou domů.",
    bloky: [
      {
        nadpis: "Svatební dary",
        text:
          "Nejradši bychom místo věcí přivítali příspěvek do naší společné budoucnosti. A kdybyste přece jen chtěli něco přinést — místo kytice rádi odvezeme granule nebo deky do útulku.",
      },
      {
        nadpis: "Dress code",
        text:
          "Svatba bude v pastelových barvách. Sladit se s nimi je milé gesto, ne povinnost.",
      },
    ],
    podpis: "Děkujeme,",
    zaver: "že budete součástí našeho velkého dne.",
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
          {klic === "hlavni" && KYTKY.map((k, i) => (
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
            {klic === "vizitka" && <Vizitka />}
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
      <p className={s.infoUvod}>{t.uvodni}</p>
      {t.bloky.map((b) => (
        <section key={b.nadpis} className={s.infoBlok}>
          <h2 className={s.infoNadpis}>{b.nadpis}</h2>
          <p className={s.infoText}>{b.text}</p>
        </section>
      ))}
      <p className={s.podpis}>{t.podpis}</p>
      <p className={s.infoZaver}>{t.zaver}</p>
    </>
  );
}

function Vizitka() {
  const t = T.vizitka;
  return (
    <>
      <p className={s.vizitkaUvod}>{t.uvod}</p>
      <p className={s.vizitkaHlavni}>{t.hlavni}</p>
    </>
  );
}
