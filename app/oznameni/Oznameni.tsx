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

/* Archy spad nemají: řežou se z nich jen linie MEZI kartami, vnější okraj
   zůstane, jak vyjel z tiskárny. Se spadem by první kartička dostala navíc
   3 mm nahoře, poslední 3 mm dole a všechny 3 mm po stranách — a rámeček nebo
   okraj kolem obsahu by na krajních kusech seděl jinak než na prostředních.
   Bez spadu je list přesně 148 x 200 a tři řezy z něj udělají čtyři stejné
   kartičky. */
const SPAD_ARCHU = 0;

type KartaKlic = "hlavni" | "info" | "rub" | "qr" | "pasek" | "obrad" | "vizitka" | "archObrad" | "archStolu" | "archQr";

const KARTY: { klic: KartaKlic; nazev: string; sirka: number; vyska: number; zona: number; spad?: number }[] = [
  { klic: "hlavni", nazev: "Hlavní (A5)", sirka: 148, vyska: 210, zona: 10 },
  /* Informační karta je stejně široká jako hlavní, aby se daly srovnat na sebe.
     QR kód na ní není. Vešel by se, ale karta by tím byla zaplněná na 99 %
     a kód by v jinak vystředěné sazbě působil dolepeně. Má proto vlastní
     kartičku — a hlavně: rub i líc téhle karty host přečte a odloží, kdežto
     samostatný kus musí vzít do ruky. */
  { klic: "info", nazev: "Informace (148 × 168)", sirka: 148, vyska: 168, zona: 10 },
  { klic: "rub", nazev: "Detaily (rub)", sirka: 148, vyska: 168, zona: 10 },
  /* Kartička s QR. Formát pozvánek, aby se tiskla po čtyřech na A5 stejně jako
     ony, ale vzhled karty s detaily — růžový rámeček a bílý střed. */
  { klic: "qr", nazev: "QR na web", sirka: 148, vyska: 50, zona: 6 },
  /* Arch proužků s fotkami. Proužky jsou samostatné, přikládají se ke kartě —
     ale tisknou se po třech na jednu A5 a řežou se z ní. Proto je karta A5
     a ne proužek: jeden tisk, dva řezy. Bezpečná zóna je nulová, protože
     obsah má sahat až k ořezu a dělí se přesně na třetiny. */
  { klic: "pasek", nazev: "Pásky s fotkami (A5)", sirka: 148, vyska: 210, zona: 0, spad: SPAD_ARCHU },
  /* Obě pozvánky jsou široké jako A5, aby se v sadě srovnaly s ostatními.
     Z pruhu 148 x 50 mm vyjde z jedné A4 rovnou několik kusů. */
  { klic: "obrad", nazev: "Pozvánka na obřad", sirka: 148, vyska: 50, zona: 6 },
  { klic: "vizitka", nazev: "Pozvánka ke stolu", sirka: 148, vyska: 50, zona: 6 },
  /* Archy pozvánek. Pozvánka je 148 x 50 mm, takže se čtyři vejdou na výšku
     200 mm a řežou se třemi vodorovnými řezy. Bezpečná zóna je nulová: obsah
     sahá až k ořezu a dělí se přesně na čtvrtiny. */
  { klic: "archObrad", nazev: "Pozvánky na obřad (arch)", sirka: 148, vyska: 200, zona: 0, spad: SPAD_ARCHU },
  { klic: "archStolu", nazev: "Pozvánky ke stolu (arch)", sirka: 148, vyska: 200, zona: 0, spad: SPAD_ARCHU },
  { klic: "archQr", nazev: "QR na web (arch)", sirka: 148, vyska: 200, zona: 0, spad: SPAD_ARCHU },
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
  /* Rozsah výšky snítek. Stejný na všech kusech sady: karty se skládají na sebe
     a kdyby měla každá jinak velké kytky, je ten rozdíl na hromádce hned vidět.
     Sedmnáct milimetrů je strop — na pozvánce vysoké padesát je víc už moc. */
  nejmensi = 11, nejvetsi = 17,
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

/* Na pozvánkách stejný rozsyp i stejná velikost snítek jako na hlavní kartě — pravidelná mřížka, jedna
   snítka na buňku, takže mají všude podobné rozestupy a žádná nepřekrývá
   druhou. Ručně skládané kytice na koncích pruhu vypadaly rozsypaně a půlka
   snítek končila useknutá krajem.

   Zakázaná plocha je svisle odměřená těsně na text (20,1 až 35,9 mm), ne od
   oka — při větší svislé rezervě vypadnou i buňky nad textem a pod ním a v pruhu
   zůstanou díry. Vodorovně je rezerva naopak štědrá: psací písmo má dlouhé tahy
   a snítka, která končila tři milimetry před „ke“, se ho opticky dotýkala.

   Velikost snítek je schválně stejná jako na A5. Dřív byly na pozvánce menší
   (8 až 12 mm proti 13 až 22 mm) a samo o sobě to vypadalo dobře — jenže když
   se karty položí na sebe, jde ten rozdíl vidět na první pohled. */
const KYTKY_MALE = rozsyp(154, 56, 6, 3, [
  { x1: 38, y1: 19, x2: 116, y2: 37 },
]);

/* Proužek na archu má tytéž kytky, jen posunuté o spad: na kartě jsou
   souřadnice od kraje se spadem, na archu od ořezu, protože mezi proužky žádný
   spad není. Co na kartě přeteče přes ořez, se na archu ustřihne na řezu —
   výsledná pozvánka vypadá stejně. */
const KYTKY_PRUH = KYTKY_MALE.map((k) => ({ ...k, x: k.x - 3, y: k.y - 3 }));

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
    poznamka: "Doražte prosím na obřad s předstihem.",
  },
  {
    nadpis: "Svatební dary",
    text:
      "Nejradši bychom místo věcí přivítali příspěvek do naší společné budoucnosti — svatební kasička bude po ruce. A místo kytky nebo lahve rádi odvezeme granule, deky nebo hračky našim chlupatým kamarádům do útulku.",
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
  qr: {
    /* Jmenovitě to, co na webu doopravdy je: ubytování s rezervací, svatební
       i dětské menu, program dne a sekce „Ptáte se“. Obecné „bližší informace“
       nikoho nedonutí kód naskenovat. */
    popis: "Ubytování, svatební menu, program dne i odpovědi na další otázky najdete na našem svatebním webu.",
  },
  rub: {
    /* Ampersand, ne plus — web má všude „Kateřina & Jakub“ a „K & J“. Plus
       zůstává jen v kresleném srdci u „Náš příběh“, tam je jako vyrytina do
       stromu na místě. */
    iniciály: "K & J",
    nadpis: "Detaily",
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
  const spad = karta.spad ?? SPAD;
  const spadSirka = karta.sirka + spad * 2;
  const spadVyska = karta.vyska + spad * 2;

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
            {karta.nazev}: {spad
              ? `ořez ${karta.sirka} × ${karta.vyska} mm, se spadem ${spadSirka} × ${spadVyska} mm`
              : `${karta.sirka} × ${karta.vyska} mm bez spadu — řeže se jen mezi kartičkami`}. Tiskne
            se po jedné kartě — v dialogu zvolte „Uložit jako PDF“, okraje
            „Žádné“ a zapněte grafiku pozadí.
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
            "--spad": `${spad}mm`,
            "--zona": `${karta.zona}mm`,
          } as React.CSSProperties
        }
      >
        <section className={`${s.karta} ${s[`k-${klic}`]}`} aria-label={`Karta: ${karta.nazev}`}>
          {/* Kytky leží pod textem a smí zasahovat až do spadu — po ořezu se
              některé nakousnou, přesně jak to má předloha. */}
          {(klic === "hlavni" ? KYTKY
            : klic === "obrad" || klic === "vizitka" ? KYTKY_MALE
            : []
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
            {klic === "qr" && <KartaQr />}
            {klic === "rub" && (
              <>
                {/* Iniciály a datum nahoře, ať strana není jen jedno slovo na
                    prázdné ploše — kartička leží na oznámení touhle stranou. */}
                <p className={s.rubJmena}>{T.rub.iniciály}</p>
                <p className={s.rubDatum}>{T.hlavni.datum}</p>
                <p className={s.rubNadpis}>{T.rub.nadpis}</p>
              </>
            )}
            {klic === "pasek" && <Pasek voditka={ukazVoditka} />}
            {klic === "obrad" && <Zvani {...T.obrad} />}
            {klic === "archObrad" && <ArchPozvanek zvani={T.obrad} voditka={ukazVoditka} />}
            {klic === "archStolu" && <ArchPozvanek zvani={T.vizitka} voditka={ukazVoditka} />}
            {klic === "archQr" && <ArchQr voditka={ukazVoditka} />}
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

/* Arch čtyř stejných pozvánek pod sebou. Každý proužek má vlastní ořez
   (overflow), takže kytka, která přeteče přes řez, se ustřihne přesně tam, kde
   se bude řezat — na hotové pozvánce to vypadá stejně jako na samostatné kartě.

   Všechny čtyři jsou stejné, ne čtyři varianty: jde o to mít víc kusů téhož. */
function ArchPozvanek({ zvani, voditka }: { zvani: { uvod: string; hlavni: string }; voditka: boolean }) {
  return (
    <div className={s.archPozvanek}>
      {[0, 1, 2, 3].map((poradi) => (
        <div key={poradi} className={s.pozvankaProuzek}>
          {KYTKY_PRUH.map((k, i) => (
            <img
              key={i}
              className={s.kytka}
              src={`/oznameni/kyticky/${k.snitka}.png`}
              alt=""
              aria-hidden="true"
              style={{ left: `${k.x}mm`, top: `${k.y}mm`, height: `${k.v}mm`, rotate: `${k.uhel}deg` }}
            />
          ))}
          <div className={s.pozvankaText}>
            <p className={s.vizitkaUvod}>{zvani.uvod}</p>
            <p className={s.vizitkaHlavni}>{zvani.hlavni}</p>
          </div>
        </div>
      ))}

      {/* Kudy řezat. Jen na obrazovce — do PDF pro tiskárnu nesmí. */}
      {voditka && [1, 2, 3].map((i) => (
        <i key={i} className={s.archRez} style={{ top: `${i * 50}mm` }} aria-hidden="true" />
      ))}
    </div>
  );
}

/* Kartička s QR kódem na svatební web. QR je vedle popisku, ne nad ním — na
   pruhu vysokém padesát milimetrů by nad sebou nebylo místo na obojí.

   Kód je vektor (scripts/qr-oznameni.mjs), takže v tiskovém PDF zůstane ostrý
   při jakékoli velikosti a nemusí se hlídat 300 dpi. */
function KartaQr() {
  return (
    <div className={s.qrBlok}>
      <img className={s.qrKod} src="/oznameni/qr.svg" alt="" aria-hidden="true" />
      <p className={s.qrPopis}>{T.qr.popis}</p>
    </div>
  );
}

/* Arch čtyř QR kartiček. Růžový rámeček nese celá karta včetně spadu, proto se
   v proužku kreslí jen bílý vnitřek — kdyby měl růžovou každý proužek zvlášť,
   na vnějším okraji archu by po ořezu mohl svítit bílý proužek papíru.

   Mezi dvěma sousedními proužky se tím potkají dva čtyřmilimetrové rámečky do
   osmimilimetrového pruhu, který se řezem rozdělí na půl. */
function ArchQr({ voditka }: { voditka: boolean }) {
  return (
    <div className={s.archPozvanek}>
      {[0, 1, 2, 3].map((poradi) => (
        <div key={poradi} className={s.qrProuzek}>
          <div className={s.qrBlok}>
            <img className={s.qrKod} src="/oznameni/qr.svg" alt="" aria-hidden="true" />
            <p className={s.qrPopis}>{T.qr.popis}</p>
          </div>
        </div>
      ))}

      {/* Kudy řezat. Jen na obrazovce — do PDF pro tiskárnu nesmí. */}
      {voditka && [1, 2, 3].map((i) => (
        <i key={i} className={s.archRez} style={{ top: `${i * 50}mm` }} aria-hidden="true" />
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
