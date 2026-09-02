"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";

const VenueMap = dynamic(() => import("./VenueMap"), {
  ssr: false,
  loading: () => <div className="venue-map-scene venue-map-loading" />,
});

import Ring3D from "./Ring3D";
import Ubytovani from "./Ubytovani";
import Link from "next/link";
import Ikona from "./ProgramIkony";
import { SnitkaKvet } from "./Kytky";
import { Kopirovat, PridatDoKalendare, SdiletWeb } from "./Akce";
import { KONTAKTY, formatTel, type Kontakt } from "./kontakty";
import { VENUE_ADDRESS } from "./venue";
import { SipkaChorvatsko, SipkaKlikni, SipkaPrvniFotka, SipkaZasnuby, SrdceIniciraly } from "./StoryDoodles";


// hlášky z Pána prstenů, lehce svatebně upravené
/* V hlášce jsou mezi částmi data nezlomitelné mezery (U+00A0, v editoru
   vypadají jako obyčejné) — jinak se datum v úzkém sloupci lámalo mezi
   „18.“ a „09.“ na dva řádky. */
const LOTR_QUOTES = [
  "Jeden prsten vládne všem. Od 18. 09. 2027 budou dva.",
  "You shall not pass!… teda, bez pozvánky.",
  "Ani Frodo nenesl nic tak vzácného, jako jsou tyhle prstýnky.",
];

/* Majáky Gondoru na hřebenech panoramatu: [x, y, zpoždění v s]. Souřadnice
   jsou skutečné vrcholy hory.svg (lokální minima jeho polyline), ne odhad —
   plamínek musí stát na hřebeni, ne vedle něj. Rozhořívají se zleva doprava a všechny leží mezi x≈300 a x≈1100, aby
   přežily i oříznutí panoramatu na telefonu.
   Nejvyšší vrchol (760, 111) je schválně vynechaný — stojí na něm zvonička. */
const MAJAKY: [number, number, number][] = [
  [325, 138, 0.6],
  [525, 157, 1.5],
  [1065, 170, 2.4],
];

// TODO: skutečné datum svatby
const WEDDING_DATE = new Date("2027-09-18T12:00:00+02:00");
/* Půlnoc na začátku svatebního dne. Rozcestník na fotky se přepíná tímhle,
   ne časem obřadu — hosté fotí od snídaně, v poledne by bylo pozdě. Zapsáno
   jako výslovný okamžik s posunem +02:00, ne dopočtem z WEDDING_DATE přes
   setHours: to by u hosta v jiném pásmu spadlo na jinou půlnoc. */
const SVATEBNI_DEN = new Date("2027-09-18T00:00:00+02:00");

function useCountdown(target: Date) {
  const [left, setLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  useEffect(() => {
    const tick = () => {
      const s = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
      setLeft({
        d: Math.floor(s / 86400),
        h: Math.floor((s / 3600) % 24),
        m: Math.floor((s / 60) % 60),
        s: s % 60,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // pokud je prvek při mountu už (byť částečně) ve viewportu, ukaž ho rovnou —
    // observer by na už-viditelný prvek nemusel spolehlivě zareagovat
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      el.classList.add("in");
      return;
    }

    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}

/* Ostrá je vždycky ta sekce, která zrovna prochází prostředkem okna; ostatní
   se lehce zamlží, takže předěl mezi dvěma barvami pozadí netahá oko zpátky.
   Rozostřuje se jen obsah (.reveal), ne sekce jako celek — blur na sekci by
   rozmazal i její okraj a mezi barvami by vznikla viditelná hrana. */
function useZaostreniSekci() {
  useEffect(() => {
    // s vypnutými animacemi ať web zůstane celý ostrý
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const sekce = document.querySelectorAll<HTMLElement>(".obsah-ramec > section");
    if (!sekce.length) return;

    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) =>
          e.target.classList.toggle("sekce-mimo", !e.isIntersecting),
        ),
      // úzký pás uprostřed okna — sekce je ostrá, dokud jím prochází
      { rootMargin: "-42% 0px -42% 0px" },
    );
    sekce.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);
}

/* Po svatbě rozcestník vyzývá k nahrání fotek, před ní galerii jen slibuje —
   host by jinak klikl do prázdné stránky. Vyhodnocuje se až v efektu, ne při
   renderu: server nezná čas prohlížeče a HTML by se při hydrataci rozešlo.
   Prvního renderu si nikdo nevšimne, sekce je do té doby schovaná v <Reveal>.
   Interval hlídá web nechaný otevřený přes půlnoc před svatbou. */
function usePoSvatbe() {
  const [po, setPo] = useState(false);
  useEffect(() => {
    const zkontroluj = () => setPo(Date.now() >= SVATEBNI_DEN.getTime());
    zkontroluj();
    const t = setInterval(zkontroluj, 60_000);
    return () => clearInterval(t);
  }, []);
  return po;
}

type Barva = { nazev: string; hex: string };

/* Nejčastější dotazy. Přidávat/mazat se dá rovnou tady — sekce se vykreslí sama. */
const DOTAZY: { q: string; a: string; barvy?: Barva[]; kontakty?: Kontakt[] }[] = [
  {
    q: "Je na svatbě nějaký dresscode?",
    a: "Svatba bude v pastelových barvách. Sladit se s nimi je milé gesto, ne povinnost — hlavně ať vám je v tom, co si vezmete, dobře.",
    barvy: [
      { nazev: "Světle modrá", hex: "#c3d7ec" },
      { nazev: "Broskvová", hex: "#f6c396" },
      { nazev: "Růžová", hex: "#f5a3a8" },
      { nazev: "Světle růžová", hex: "#f4d3d9" },
      { nazev: "Modrá", hex: "#a8c8ec" },
      { nazev: "Krémově žlutá", hex: "#f8e4a3" },
      { nazev: "Šalvějová", hex: "#b7d3ab" },
    ],
  },
  {
    q: "Bude na svatbě zajištěn odvoz?",
    a: "Odvoz ze svatby zajištěný máme — od 15 hodin budou k dispozici dva řidiči, kteří vás rádi odvezou domů. Dopravu na místo si ale, prosím, zařiďte každý sám.",
  },
  {
    q: "Můžeme vzít děti?",
    a: "S vašimi dětmi počítáme a vzít je samozřejmě můžete. Asi si ale všichni — vy i vaše děti — večer užijeme víc, pokud je necháte na pár hodin u prarodičů nebo příbuzných. Pokud se nakonec rozhodnete je nevzít, dejte nám prosím vědět.",
  },
  {
    q: "Jak to bude s fotkami od hostů?",
    a: "Na svatbě bude vyvěšený QR kód. Načtete ho foťákem v telefonu a otevře se stránka, kam nahrajete, co jste během dne nafotili — fotky i videa. Nemusíte nic instalovat ani se nikam přihlašovat.\n\nVšechno se sejde na jednom místě, kde si to všichni můžou prohlédnout, dát tomu srdíčko nebo si to stáhnout. Když něco nahrajete omylem, můžete to sami smazat.\n\nJen prosíme: během obřadu telefony do kapsy, fotíme až po jeho skončení. Stejnou galerii pak najdete i tady na webu, takže se k ní vrátíte, i když už QR kód po ruce mít nebudete.",
  },
  {
    q: "Na koho se obrátit v den svatby?",
    a: "Novomanželé budou mít telefon nejspíš někde v kabelce nebo v saku. Když se ztratíte, zpozdíte nebo budete cokoli potřebovat, volejte nebo pište svědkům:",
    kontakty: KONTAKTY,
  },
  {
    q: "Co si přejete za dar?",
    a: "Nejradši bychom místo věcí, které stejně brzy skončí v šuplíku, přivítali příspěvek do naší společné budoucnosti — svatební kasička bude po ruce. A pokud byste přece jen chtěli něco přinést, mysleli jsme na naše chlupaté kamarády: místo kytice nebo lahve rádi odvezeme granule, deky nebo hračky do jednoho ze dvou útulků, se kterými jsme domluveni.",
  },
];

/* Jeden dotaz. Výšku odpovědi měříme a nastavujeme v px — do `auto` se plynule
   animovat nedá, tak ji po každém přepnutí změříme z obsahu. */
function Dotaz({ q, a, barvy, kontakty }: { q: string; a: string; barvy?: Barva[]; kontakty?: Kontakt[] }) {
  const [otevreno, setOtevreno] = useState(false);
  const [vyska, setVyska] = useState(0);
  const obsah = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const zmer = () => setVyska(otevreno ? obsah.current?.scrollHeight ?? 0 : 0);
    zmer();
    if (!otevreno) return;
    // text se při změně šířky přelomí jinak, takže otevřenou odpověď přeměřujeme
    window.addEventListener("resize", zmer);
    return () => window.removeEventListener("resize", zmer);
  }, [otevreno]);

  return (
    <div className={`faq-item ${otevreno ? "open" : ""}`}>
      <button
        type="button"
        className="faq-otazka"
        aria-expanded={otevreno}
        onClick={() => setOtevreno((o) => !o)}
      >
        <span>{q}</span>
        <span className="faq-znak" aria-hidden="true" />
      </button>
      <div className="faq-obal" style={{ height: vyska }}>
        <div className="faq-odpoved" ref={obsah}>
          {/* Delší odpovědi se dají v textu rozdělit prázdným řádkem a vysází
             se jako samostatné odstavce — jeden dlouhý blok se čte hůř. */}
          {a.split("\n\n").map((odstavec, i) => (
            <p key={i}>{odstavec}</p>
          ))}
          {kontakty && (
            <ul className="faq-kontakty">
              {kontakty.map((k) => (
                <li key={k.jmeno}>
                  <span className="faq-kontakt-jmeno">
                    {k.jmeno} <small>{k.role}</small>
                  </span>
                  <span className="faq-kontakt-odkazy">
                    <a href={`tel:${k.tel}`}>{formatTel(k.tel)}</a>
                    <a href={`https://wa.me/${k.tel.replace("+", "")}`} target="_blank" rel="noopener">
                      WhatsApp
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {barvy && (
            <ul className="faq-barvy">
              {barvy.map((b) => (
                <li key={b.hex}>
                  {/* název jen pro čtečky — vizuálně stačí samotná kulička */}
                  <span className="faq-kulicka" style={{ background: b.hex }} />
                  <span className="faq-skryte">{b.nazev}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/* Odpočet je vlastní komponenta, aby vteřinový tik nepřerendrovával celou
   stránku — dřív kvůli němu React každou vteřinu procházel všechny sekce. */
function Odpocet() {
  const left = useCountdown(WEDDING_DATE);
  return (
    <section className="countdown" id="countdown">
      <Reveal className="wrap">
        <p className="eyebrow">Odpočítáváme</p>
        <h2>Zbývá do svatby</h2>
        <div className="count">
          <div>
            <b>{left ? left.d : "–"}</b>
            <span>dní</span>
          </div>
          <div>
            <b>{left ? pad(left.h) : "–"}</b>
            <span>hodin</span>
          </div>
          <div>
            <b>{left ? pad(left.m) : "–"}</b>
            <span>minut</span>
          </div>
          <div>
            <b>{left ? pad(left.s) : "–"}</b>
            <span>vteřin</span>
          </div>
        </div>
        {/* ať si datum nemusí nikdo přepisovat ručně */}
        <div className="akce-radek">
          <PridatDoKalendare />
        </div>
      </Reveal>
    </section>
  );
}

/* hromádka fotek u „Náš příběh“ — kliknutím se přeloží vrchní fotka dozadu */
const PRIBEH_FOTKY = [
  { src: "/fotky/1.jpeg", alt: "Zásnuby na Troskách" },
  { src: "/fotky/2.jpeg", alt: "První společná fotka" },
  { src: "/fotky/4.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/6.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/11.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/16.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/20.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/21.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/22.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/23.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/24.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/25.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/26.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/27.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/28.jpeg", alt: "Kateřina a Jakub" },
];

// jak leží jednotlivé fotky na hromádce (0 = úplně navrchu)
const HROMADKA_SLOTY = [
  { rot: -1.5, x: 0, y: 0 },
  { rot: 3.2, x: 12, y: 8 },
  { rot: -4, x: -10, y: 15 },
  { rot: 2.4, x: 6, y: 22 },
];

function FotoHromadka() {
  const [aktivni, setAktivni] = useState(0);
  // až po prvním kliknutí smí odcházející fotka animovat odchod — jinak by
  // spodní fotka při prvním vykreslení bliknula
  const [listoval, setListoval] = useState(false);
  const pocet = PRIBEH_FOTKY.length;

  return (
    <button
      type="button"
      className="foto-hromadka"
      onClick={() => {
        setListoval(true);
        setAktivni((i) => (i + 1) % pocet);
      }}
      aria-label="Zobrazit další fotku"
    >
      {PRIBEH_FOTKY.map((foto, i) => {
        const slot = (i - aktivni + pocet) % pocet;
        const viditelny = slot < HROMADKA_SLOTY.length;
        // fotka, která právě odešla z vršku — odhodí se doprava a zapadne pod hromádku
        const odchazi = listoval && slot === pocet - 1;
        const poloha = HROMADKA_SLOTY[Math.min(slot, HROMADKA_SLOTY.length - 1)];
        return (
          <motion.img
            key={foto.src}
            src={foto.src}
            alt={slot === 0 ? foto.alt : ""}
            className={`foto-list ${slot === 0 ? "foto-vrchni" : ""}`}
            initial={false}
            animate={
              odchazi
                ? {
                    // decentní: fotka jen kousek sklouzne a rozplyne se
                    // nad tou další — působí to jako listování, ne odhazování
                    x: 22, y: 12, rotate: 2.5, opacity: 0,
                  }
                : {
                    x: poloha.x,
                    y: poloha.y,
                    rotate: poloha.rot,
                    opacity: viditelny ? 1 : 0,
                  }
            }
            transition={
              odchazi
                ? { duration: 0.5, ease: "easeOut" }
                : { type: "spring", stiffness: 170, damping: 26, mass: 1 }
            }
            style={{ zIndex: odchazi ? pocet + 1 : pocet - slot }}
          />
        );
      })}
      {/* ručně psaná šipka — zve k listování a zůstává vidět pořád */}
      <span className="doodle-obal doodle-obal-klikni" aria-hidden="true">
        <SipkaKlikni />
      </span>
      {/* popisky patří ke konkrétním fotkám a ukážou se jen když jsou navrchu:
          „zásnuby na Troskách“ k první, „první společná fotka“ k zimní druhé,
          „první Chorvatsko jako rodina“ k fotce z krčského přístavu */}
      <AnimatePresence>
        {(aktivni === 0 || aktivni === 1 || aktivni === 8) && (
          <motion.span
            key={aktivni}
            className="doodle-obal doodle-obal-zasnuby"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            {aktivni === 0 ? <SipkaZasnuby /> : aktivni === 1 ? <SipkaPrvniFotka /> : <SipkaChorvatsko />}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

export default function Home() {
  // loading → done (loader pryč, web odemčený)
  const [stage, setStage] = useState<"loading" | "done">("loading");
  const [quote, setQuote] = useState<string | null>(null);
  const [mapaOtocena, setMapaOtocena] = useState(false);
  // po doznění fade-outu loader úplně odmountujeme — jinak by three.js
  // prsten (requestAnimationFrame + WebGL) běžel skrytý celou návštěvu
  const [loaderGone, setLoaderGone] = useState(false);

  useEffect(() => {
    setQuote(LOTR_QUOTES[Math.floor(Math.random() * LOTR_QUOTES.length)]);
  }, []);

  useZaostreniSekci();
  const poSvatbe = usePoSvatbe();

  /* Dovnitř se jde klepnutím na prsten, ne po odpočtu — úvodní obrazovka
     tak počká, dokud host sám nechce dál. */
  const vstup = () => {
    if (stage !== "loading") return;
    setStage("done");
    // 1s = rezerva na .9s opacity transition loaderu; teprve pak ho
    // odmountujeme, jinak by three.js prsten běžel skrytý celou návštěvu
    setTimeout(() => setLoaderGone(true), 1000);
  };

  // dokud je na obrazovce loader, stránka pod ním nescrolluje
  useEffect(() => {
    document.body.style.overflow = stage === "done" ? "" : "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [stage]);

  return (
    <>
      {/* Úvodní obrazovka: zlatý prsten a hláška.

         Klepnout jde kamkoli, nejen na prsten — kdo netrefí kroužek o 170 px,
         zůstal by na úvodní obrazovce stát a dál se nedostal. Tlačítko pod
         prstenem zůstává kvůli klávesnici a čtečkám; jeho klepnutí probublá
         na obal, ale vstup() druhé volání ignoruje. */}
      {!loaderGone && (
        <div
          className={`loader ${stage !== "loading" ? "loader-hide" : ""}`}
          aria-hidden={stage !== "loading"}
          onClick={vstup}
        >
          {/* Panorama Beskyd a na třech hřebenech majáky, které se jeden po
             druhém rozhoří. Panorama je pozadí .loader-hory, majáky zvlášť —
             kdyby byly uvnitř, srazila by je jeho opacita .55 a plamínky by
             nebyly světlejší než hory. Zarovnání drží tím, že mají stejnou
             krabici a preserveAspectRatio xMidYMax odpovídá background-size
             auto 100 % / center bottom. */}
          <span className="loader-hory" aria-hidden="true" />
          <svg
            className="loader-majaky"
            viewBox="0 0 1400 300"
            preserveAspectRatio="xMidYMax meet"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <radialGradient id="majak-zar">
                <stop offset="0%" stopColor="#ffd9a0" stopOpacity=".95" />
                <stop offset="45%" stopColor="#e8a24c" stopOpacity=".4" />
                <stop offset="100%" stopColor="#e8a24c" stopOpacity="0" />
              </radialGradient>
            </defs>
            {MAJAKY.map(([x, y, zpozdeni]) => (
              <g
                key={x}
                className="majak"
                transform={`translate(${x} ${y})`}
                style={{ animationDelay: `${zpozdeni}s` }}
              >
                {/* hranice ze zkřížených polen; kreslí se ve stejné barvě jako
                   hory, jen o něco sytěji, ať je pod plamenem vidět */}
                <path
                  className="majak-hranice"
                  d="M -5.5 0 L 3.5 -6.5 M 5.5 0 L -3.5 -6.5 M 0 0 L 0 -7"
                  fill="none"
                  stroke="#9a8158"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <circle className="majak-zar" cy="-13" r="26" fill="url(#majak-zar)" />
                {/* plamen začíná až nad hranicí (y = −6), ne na zemi */}
                <path
                  className="majak-plamen"
                  d="M 0 -6 C -4.5 -11, -4 -18, 0 -23 C 4 -18, 4.5 -11, 0 -6 Z"
                  fill="#f0b45e"
                />
              </g>
            ))}
          </svg>
          <div className="loader-brand">
            K &amp; J
            <span className="loader-date">18 · 09 · 2027</span>
          </div>
          {/* prsten je tlačítko, ne jen obrázek — jinak by se dovnitř nedostal
             nikdo, kdo web ovládá klávesnicí nebo čtečkou */}
          <button
            type="button"
            className="loader-vstup"
            onClick={vstup}
            aria-label="Vstoupit na svatební web"
          >
            <Ring3D />
          </button>
          {quote && <p className="loader-quote">{quote}</p>}
          <p className="loader-vyzva">Klepněte</p>
        </div>
      )}

      {/* fullscreen hero — fotka přes celou obrazovku, bez hlavičky */}
      <section className="hero-full" id="hero">
        <img className="hero-bg" src="/fotky/kaplicka.png" alt="Kaplička" />
        <div className={`hero-content ${stage === "done" ? "in" : ""}`}>
          <p className="hero-eyebrow">Bereme se</p>
          <h1 className="hero-title">Kateřina &amp; Jakub</h1>
          <div className="hero-date">18 · 09 · 2027</div>
        </div>
        <a className="hero-scroll" href="#countdown" aria-label="Posunout dolů">
          <span />
        </a>
      </section>

      {/* od odpočtu níž rámuje obsah tenká linka a po stranách jdou květiny;
          panorama Beskyd (hory.svg) je jen na úvodní obrazovce, ne tady */}
      <div className="obsah-ramec">

      {/* countdown */}
      <Odpocet />

      {/* příběh */}
      <section className="story" id="story">
        <Reveal className="story-grid">
          <div className="story-photo">
            <FotoHromadka />
          </div>
          <span className="doodle-obal doodle-obal-srdce" aria-hidden="true">
            <SrdceIniciraly />
          </span>
          <div className="story-text">
            <p className="eyebrow">Náš příběh</p>
            <h2>Jak to celé začalo</h2>
            <p className="lead">
              Pět let spolu, jedno zásnubní „ano“ na Troskách a teď nás čeká naše
              největší společné dobrodružství. Poznali jsme se, zamilovali se,
              prošli spolu krásnými i náročnějšími chvílemi a vybudovali domov
              plný smíchu, lásky a společných vzpomínek. Dnes už víme, že chceme
              jít životem bok po boku – a proto si 18. září 2027 řekneme své „ano“.
            </p>
          </div>
        </Reveal>
      </section>

      {/* místo */}
      <section className="location" id="location">
        <Reveal className="wrap">
          <p className="eyebrow">Kde se to stane</p>
          <h2>Místo konání</h2>
          <p className="lead venue-address">
            <span className={`venue-address-main${mapaOtocena ? " je-schovany" : ""}`}>
              Trojanovice 2 · 744 01 Trojanovice-Frenštát pod Radhoštěm
            </span>
            <span className={`venue-address-alt${mapaOtocena ? " je-videt" : ""}`} aria-hidden="true">
              Hotel Rekovice
            </span>
          </p>
          {/* pro ty, kdo si adresu vkládají do vlastní navigace nebo posílají dál */}
          <Kopirovat className="venue-kopirovat" text={VENUE_ADDRESS} popisek="Kopírovat adresu" />
          <VenueMap onFlipChange={setMapaOtocena} />
          <Ubytovani />
        </Reveal>
      </section>

      {/* program */}
      <section className="schedule" id="schedule">
        <Reveal className="wrap">
          <p className="eyebrow">Nahlédněte</p>
          <h2>Program dne</h2>
        </Reveal>
        <Reveal className="events">
          <div className="event">
            <Ikona typ="snidane" />
            <h3>Snídaně</h3>
            <div className="meta">9:00 · U ženicha a nevěsty</div>
            <p>Poslední klidné sousto před tím, než to celé začne.</p>
          </div>
          <div className="event">
            <Ikona typ="obrad" />
            <h3>Obřad</h3>
            <div className="meta">12:00 · U Zvoničky v Rekovicích</div>
            <p>Tady si řekneme své „ano“. Kapesníčky doporučujeme mít po ruce.</p>
          </div>
          <div className="event">
            <Ikona typ="foceni" />
            <h3>Společné focení</h3>
            <div className="meta">13:00</div>
            <p>Chvilka pro novomanžele a pár fotek, které budeme ukazovat ještě za dvacet let.</p>
          </div>
          <div className="event">
            <Ikona typ="pripitek" />
            <h3>Přípitek &amp; oběd</h3>
            <div className="meta">13:30</div>
            <p>Na zdraví, na lásku a na pořádný hlad.</p>
          </div>
          <div className="event">
            <Ikona typ="dort" />
            <h3>Krájení dortu</h3>
            <div className="meta">15:30</div>
            <p>První společný řez. Nůž držíme oba, vinu neseme napůl.</p>
          </div>
          <div className="event">
            <Ikona typ="tanec" />
            <h3>První tanec</h3>
            <div className="meta">16:30</div>
            <p>Jeden tanec a žádné záruky elegance.</p>
          </div>
          <div className="event">
            <Ikona typ="odpoledne" />
            <h3>Svatební odpoledne</h3>
            <div className="meta">Odpoledne</div>
            <p>Dobré jídlo, sklenka v ruce a čas užít si den naplno.</p>
          </div>
          <div className="event">
            <Ikona typ="party" />
            <h3>Večerní párty</h3>
            <div className="meta">Od 19:00</div>
            <p>Boty dolů, hudbu nahoru.</p>
          </div>
        </Reveal>
      </section>

      {/* menu */}
      <section className="menu" id="menu">
        <Reveal className="menu-karta">
          <span className="menu-masle" aria-hidden="true" />
          <div className="wrap">
            <p className="eyebrow">Dobrou chuť</p>
            <h2>Svatební menu</h2>
            <p className="lead">
              To nejlepší z kuchyně. Klidně si nalžeme, že jste se nejvíc těšili na obřad —
              my víme svoje. Dobrou chuť!
            </p>
          </div>
          <div className="events">
          <div className="event">
            <div className="meta">Polévka</div>
            <h3>Svatební vývar</h3>
            <p>Játrové knedlíčky, zelenina, nudle</p>
          </div>
          <div className="event">
            <div className="meta">Hlavní chod</div>
            <h3>Vepřová panenka v sous-vide s pečenými grenaille a pepřovou omáčkou</h3>
          </div>
          <div className="event">
            <div className="meta">Dezert</div>
            <h3>Svatební dort</h3>
            <p>Čokoládový korpus, pařížský krém, malinové compote</p>
          </div>
          </div>

          <div className="wrap menu-kids-title">
            <p className="eyebrow">Pro nejmenší</p>
            <h3>Dětské svatební menu</h3>
          </div>
          <div className="events">
            <div className="event">
              <div className="meta">Polévka</div>
              <h3>Svatební vývar</h3>
              <p>Zelenina, nudle</p>
            </div>
            <div className="event">
              <div className="meta">Hlavní chod</div>
              <h3>Kuřecí smažený řízek s bramborovým pyré</h3>
            </div>
          </div>
        </Reveal>
        {/* poznámka mimo rámeček — patří k menu, ale není to chod */}
        <Reveal className="menu-poznamka">
          <p>
            Máte-li speciální stravovací požadavky (vegetariánské, veganské či
            zdravotní), dejte nám prosím vědět předem.
          </p>
        </Reveal>
      </section>

      {/* Rozcestník na galerii fotek. Bez něj se na /fotky dalo dostat jen
         přes QR kódy na stolech — po svatbě, až kódy nikdo mít nebude, by
         byla stránka z webu nedosažitelná. */}
      <section className="fotky-odkaz" id="fotky">
        <Reveal className="wrap">
          <p className="eyebrow">Vzpomínky</p>
          <h2>Fotky od vás</h2>
          {poSvatbe ? (
            <>
              <p className="lead">
                Vyfoťte, nahrajte, rozdávejte srdíčka. Fotky i videa se tu
                objeví všem — díky, že nám pomáháte posbírat celý den.
              </p>
              <Link className="btn" href="/fotky">
                Otevřít galerii
              </Link>
            </>
          ) : (
            <p className="lead">
              18. září se tu otevře galerie, kam budete moct nahrát všechno,
              co nafotíte. Zatím je prázdná — stačí mít nabitý telefon.
            </p>
          )}
          {/* prosba platí před svatbou i v její den, proto stojí mimo podmínku */}
          <p className="fotky-prosba">
            Jen malá prosba: <strong>během obřadu nechte telefony v kapse.</strong>{" "}
            Chceme se dívat na vás, ne na displeje — a od toho máme fotografa.
            Po jeho skončení pak foťte, co hrdlo ráčí.
          </p>
        </Reveal>
      </section>

      {/* nejčastější dotazy */}
      <section className="faq" id="faq">
        <Reveal className="wrap">
          <p className="eyebrow">Ptáte se</p>
          <h2>Nejčastější dotazy</h2>
          <p className="lead">Klepnutím na otázku se rozbalí odpověď.</p>
        </Reveal>
        <Reveal className="faq-list">
          {DOTAZY.map(({ q, a, barvy, kontakty }) => (
            <Dotaz key={q} q={q} a={a} barvy={barvy} kontakty={kontakty} />
          ))}
        </Reveal>
      </section>

      <footer>
        {/* Medailonek: fotka kapličky z hera pod béžovým závojem, růžová linka
           po obvodu a uvnitř rozloučení. Uzavírá stránku tím, čím začala. */}
        <div className="paticka-kolecko">
          <SnitkaKvet className="paticka-kytka" />
          <p className="paticka-jmena">Kateřina &amp; Jakub</p>
          <p className="paticka-datum">18 · 09 · 2027</p>
          <p className="paticka-vzkaz">Těšíme se na vás</p>
        </div>
        <div className="akce-radek paticka-sdilet">
          <SdiletWeb />
        </div>
      </footer>

        {/* až za sekcemi, aby ležely nad jejich pozadím (obsah má z-index 1, zůstává navrchu) */}
        <span className="kvetiny" aria-hidden="true">
          <span className="kvetiny-pas kvetiny-l" />
          <span className="kvetiny-pas kvetiny-r" />
        </span>
        <span className="stred-pruh" aria-hidden="true" />
      </div>
    </>
  );
}
