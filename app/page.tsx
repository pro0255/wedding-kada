"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const VenueMap = dynamic(() => import("./VenueMap"), {
  ssr: false,
  loading: () => <div className="venue-map-scene venue-map-loading" />,
});

/* three.js (~180 kB gz) mimo úvodní bundle — stránka se hydratuje dřív
   a do té doby na místě prstenu svítí jen zlatá záře z .loader-ring3d. */
const Ring3D = dynamic(() => import("./Ring3D"), {
  ssr: false,
  loading: () => <div className="loader-ring3d" />,
});

import Ubytovani from "./Ubytovani";
import { VenueAkce } from "./VenueAkce";
import Link from "next/link";
import { Kopirovat, PridatDoKalendare, SdiletWeb } from "./Akce";
import { KONTAKTY, formatTel, type Kontakt } from "./kontakty";
import { VENUE_ADDRESS } from "./venue";
import FotoHromadka, { type FotkaNaHromadce } from "./FotoHromadka";


// hlášky z Pána prstenů, lehce svatebně upravené
/* V hlášce jsou mezi částmi data nezlomitelné mezery (U+00A0, v editoru
   vypadají jako obyčejné) — jinak se datum v úzkém sloupci lámalo mezi
   „18.“ a „09.“ na dva řádky. */
const LOTR_QUOTES = [
  "Jeden prsten vládne všem. Od 18. 09. 2027 budou dva.",
  "You shall not pass!… teda bez pozvánky.",
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

/* Mapa (maplibre + WebGL + dlaždice) se stáhne a spustí, až když se k ní host
   blíží — do té doby stojí na jejím místě prázdný rámeček.

   První vykreslení mapy je jedna dlouhá úloha (na pomalém telefonu kolem
   stovky ms). Kdyby přišla uprostřed scrollování, stránka by cukla, proto se
   mapa chystá už 1200 px předem a spouští se, až prohlížeč nemá co dělat
   (requestIdleCallback; Safari ho nemá, tam krátké zpoždění). */
function MapaNaDohled() {
  const ref = useRef<HTMLDivElement>(null);
  const [blizko, setBlizko] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let odlozeno = 0;
    const spust = () => setBlizko(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        odlozeno =
          typeof requestIdleCallback === "function"
            ? requestIdleCallback(spust, { timeout: 1500 })
            : window.setTimeout(spust, 300);
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (typeof cancelIdleCallback === "function") cancelIdleCallback(odlozeno);
      window.clearTimeout(odlozeno);
    };
  }, []);
  if (blizko) return <VenueMap />;
  return <div ref={ref} className="venue-map-scene venue-map-loading" />;
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
const DOTAZY: { q: string; a: string; barvy?: Barva[]; kontakty?: Kontakt[]; obrazek?: string }[] = [
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
    a: "Děti jsou vítané a počítáme s nimi. Ať už je vezmete s sebou, nebo je necháte na pár hodin u babičky, dejte nám prosím vědět — ať víme, kolik nás u stolu bude.",
  },
  {
    q: "Jak to bude s fotkami od hostů?",
    a: "Na svatbě bude vyvěšený QR kód. Načtete ho foťákem v telefonu a otevře se stránka, kam nahrajete, co jste během dne nafotili — fotky i videa. Nemusíte nic instalovat ani se nikam přihlašovat.\n\nVšechno se sejde na jednom místě, kde si to všichni můžou prohlédnout, dát tomu srdíčko nebo si to stáhnout. Když něco nahrajete omylem, můžete to sami smazat.\n\nJen prosíme: během obřadu telefony do kapsy, fotíme až po jeho skončení. Stejnou galerii pak najdete i tady na webu, takže se k ní vrátíte, i když už QR kód po ruce mít nebudete.",
  },
  {
    q: "Na koho se obrátit v den svatby?",
    a: "Telefony budeme mít nejspíš někde v kabelce nebo v saku. Když se ztratíte, zpozdíte nebo budete cokoli potřebovat, volejte nebo pište svědkům:",
    kontakty: KONTAKTY,
  },
  {
    q: "Co si přejete za dar?",
    obrazek: "/fotky/pluto-kytice.png",
    a: "Hrnce, ručníky i sklenice už doma máme, a tak nám nejvíc pomůže příspěvek do svatební kasičky. A místo kytky nebo lahve rádi odvezeme krmivo, deky nebo hračky našim chlupatým kamarádům do útulku. Tam udělají větší radost než další vázička u nás na poličce.",
  },
];

/* Jeden dotaz. Výšku odpovědi měříme a nastavujeme v px — do `auto` se plynule
   animovat nedá, tak ji po každém přepnutí změříme z obsahu. */
function Dotaz({ q, a, barvy, kontakty, obrazek }: { q: string; a: string; barvy?: Barva[]; kontakty?: Kontakt[]; obrazek?: string }) {
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
        <div className={`faq-odpoved ${obrazek ? "faq-odpoved-s-obrazkem" : ""}`} ref={obsah}>
          <div className="faq-text">
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
          {/* Obrázek leží uvnitř .faq-odpoved, takže se odkrývá tou samou
             animací výšky jako text — neobjeví se dřív ani zvlášť. */}
          {obrazek && (
            <span className="faq-obrazek" aria-hidden="true">
              <img loading="lazy" decoding="async" src={obrazek} alt="" />
            </span>
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
        {/* Věta pod čísly. Samotný odpočet je jen údaj — tohle mu dá hlas
            a zároveň zaplní pruh, ve kterém jinak stály čtyři číslice a nic. */}
        <p className="countdown-vzkaz">
          Audentes fortuna iuvat.
          {/* Překlad drobně pod citátem: kdo latinsky neumí, ať nezůstane
              u hádanky bez odpovědi. */}
          <span>štěstí přeje odvážným</span>
        </p>
        {/* ať si datum nemusí nikdo přepisovat ručně */}
        <div className="akce-radek">
          <PridatDoKalendare />
        </div>
      </Reveal>
    </section>
  );
}

/* hromádka fotek u „Náš příběh“ — kliknutím se přeloží vrchní fotka dozadu */
/* `popis` se vypíše ručním písmem do bílého pruhu pod fotkou, jako by ho tam
   někdo dopsal. Má ho jen pár fotek — u ostatních pruh zůstává prázdný. */
/* Fotky z našeho příběhu, seřazené od nejstarší. Datum i popisek jsou z Kátina
   zápisníku; podle data jsou seřazené, samotná data se ale nevypisují.
   Popisky nese jen ta trojice, co je měla od začátku — u ostatních mluví fotka
   sama a zůstává pod ní jen datum. */
const PRIBEH_FOTKY: FotkaNaHromadce[] = [
  { src: "/fotky/web/2.webp", alt: "První společná fotka", popis: "první společná fotka", popisSrc: "/písmo/text-1791314141854.png" },
  { src: "/fotky/web/27.webp", alt: "ZOO Ostrava" },
  { src: "/fotky/web/28.webp", alt: "Bílovec" },
  { src: "/fotky/web/4.webp", alt: "Chorvatsko" },
  { src: "/fotky/web/6.webp", alt: "Kozmice" },
  { src: "/fotky/web/11.webp", alt: "Sicílie" },
  { src: "/fotky/web/21.webp", alt: "Svatba I a O" },
  { src: "/fotky/web/16.webp", alt: "Těhotenské focení", popis: "těhotenské focení", popisSrc: "/písmo/text-1791314260363.png" },
  { src: "/fotky/web/22.webp", alt: "První Chorvatsko jako rodina", popis: "první Chorvatsko jako rodina", popisSrc: "/písmo/text-1791314337709.png" },
  { src: "/fotky/web/20.webp", alt: "Slovensko" },
  { src: "/fotky/web/23.webp", alt: "Štramberk" },
  { src: "/fotky/web/24.webp", alt: "FM City Fest" },
  { src: "/fotky/web/25.webp", alt: "Trogir" },
  { src: "/fotky/web/1.webp", alt: "Zásnuby na Troskách", popis: "zásnuby na Troskách", popisSrc: "/písmo/text-1791314232757.png" },
  { src: "/fotky/web/26.webp", alt: "Kutná Hora" },
];

/* Obálka s příběhem. Není kreslená v CSS, ale složená ze dvou fotek světle
   modré obálky — zavřené a otevřené (public/fotky). Vrstvy pro web z nich
   vyřezává scripts/obalka-web.mjs.

   Otevřená obálka je rozřezaná na dvě vrstvy, zadek a předek, a papír s textem
   leží mezi nimi. Jinak by papír buď překryl celou obálku, nebo zmizel za ní —
   dovnitř by se nedostal. Pořadí drží z-index: zadek 0, papír 1, předek 2,
   zavřená obálka 3, pečeť 4.

   Aby to fungovalo, nesmí <button> kolem vrstev založit vlastní vrstvení —
   proto má position: relative, ale žádný z-index. Papír je jeho sourozenec
   a mezi obrázky se vejde jen díky tomu.

   Klikací je celé tělo obálky, ne jen pečeť: pečeť je malý terč a host míří na
   obálku jako na celek. Papír klikací není, aby šel text označit a číst bez
   rizika, že se obálka pod rukou zavře. */
/* Svatební menu jako opravdové desky: zavřené nesou jen zlatý název, po
   klepnutí se obálka otočí přes hřbet doleva a odhalí rozevřené menu.

   Otáčí se doopravdy, ne prolnutím. Levá strana menu není samostatná deska,
   ale RUB obálky — přesně jako v knize, kde je první strana přilepená zevnitř
   na desku. Díky tomu stačí jediné otočení o 180° a obsah se objeví sám,
   jakmile obálka přejde přes svislou rovinu.

   Kniha je pořád široká dvě desky, jen se zavřená posune o půl desky doprava,
   aby ta jedna viditelná stála na střed. Šířka se tím neanimuje, nic v sekci
   nepodskakuje a 3D se nikde neplácne do roviny — což by se stalo, kdyby měl
   kterýkoli rodič overflow jiný než visible.

   Desky nejsou fotka. Fotky, které k nim byly po ruce, mají na deskách cizí
   potisk a vlastní nasvícení — ostrý stín přesně tam, kam patří nápis — takže
   by z podkladu byla hádanka. Takhle si určujeme barvu i velikost sami. */
function SvatebniMenu() {
  const [otevrene, setOtevrene] = useState(false);
  return (
    <div className={"menu-kniha" + (otevrene ? " je-otevrene" : "")}>
      {/* Příbory leží po stranách zavřené knihy — vlevo vidlička, vpravo nůž
          se lžící. Když se kniha rozevře, uhnou: zabrala by jim místo. */}
      <img loading="lazy" decoding="async" className="menu-pribor menu-pribor-vidlicka" src="/menu/vidlicka.webp" alt="" aria-hidden="true" />
      <img loading="lazy" decoding="async" className="menu-pribor menu-pribor-nuz" src="/menu/nuz.webp" alt="" aria-hidden="true" />
      <img loading="lazy" decoding="async" className="menu-pribor menu-pribor-lzice" src="/menu/lzice.webp" alt="" aria-hidden="true" />
      <div className="menu-vnitrek">
        {/* Pravá deska leží pod obálkou a čeká, až se odklopí. */}
        <div className="menu-deska menu-deska-prava">
          <div className="menu-list">
            <p className="menu-nadstrana">Pro naše nejmenší</p>
            <ul className="menu-chody">
              <li>
                <span className="menu-kurz">Polévka</span>
                <span className="menu-jidlo">Svatební vývar</span>
                <span className="menu-detail">Zelenina, nudle</span>
              </li>
              <li>
                <span className="menu-kurz">Hlavní chod</span>
                <span className="menu-jidlo">Smažený kuřecí řízek</span>
                <span className="menu-detail">Bramborové pyré</span>
              </li>
              <li>
                <span className="menu-kurz">Dezert</span>
                <span className="menu-jidlo">Svatební dort</span>
                <span className="menu-detail">Čokoládový korpus, pařížský krém</span>
              </li>
            </ul>
            {/* Oddělené linkou a mezerou: nalepené pod dětskými chody to
                vypadalo jako jejich podnadpis, ne jako závěr celého menu. */}
            <p className="menu-preji">Dobrou chuť</p>
            {/* Kresba prostřeného stolu; vyřezává ji scripts/menu-kresba.mjs. */}
            <img loading="lazy" decoding="async" className="menu-kresba" src="/menu/prostreno.webp" alt="" aria-hidden="true" />
          </div>
        </div>

        {/* Obálka: líc se zlatým názvem, rub s první stranou menu. */}
        <div className="menu-obalka">
          <button
            type="button"
            className="menu-deska menu-obalka-lic"
            onClick={() => setOtevrene(true)}
            aria-expanded={otevrene}
          >
            <span className="menu-obalka-obsah">
              <span className="menu-ornament" aria-hidden="true" />
              <span className="menu-nazev">Menu</span>
              <span className="menu-monogram">K &amp; J</span>
              <span className="menu-datum">18 · 09 · 2027</span>
            </span>
          </button>
          <div className="menu-deska menu-obalka-rub" onClick={() => setOtevrene(false)}>
            <div className="menu-list">
              {/* Nadpis první, vtip až pod ním: stránka má začít hlavičkou a
                  vtip pak funguje jako pointa, ne jako úvodní odstavec. */}
              <p className="menu-nadstrana">Menu</p>
              <p className="menu-uvod">
                To nejlepší z kuchyně. Klidně si nalžeme, že jste se nejvíc těšili
                na obřad — my víme svoje.
              </p>
              <ul className="menu-chody">
                <li>
                  <span className="menu-kurz">Polévka</span>
                  <span className="menu-jidlo">Svatební vývar</span>
                  <span className="menu-detail">Játrové knedlíčky, zelenina, nudle</span>
                </li>
                <li>
                  <span className="menu-kurz">Hlavní chod</span>
                  <span className="menu-jidlo">Vepřová panenka sous-vide</span>
                  <span className="menu-detail">Pečené brambory grenaille, pepřová omáčka</span>
                </li>
                <li>
                  <span className="menu-kurz">Dezert</span>
                  <span className="menu-jidlo">Svatební dort</span>
                  <span className="menu-detail">Čokoládový korpus, pařížský krém, malinový kompot</span>
                </li>
              </ul>
              {/* Poznámka o stravovacích požadavcích patří sem, ne na dětskou
                  stranu: tam se tlačila pod ilustraci, kdežto levá strana má
                  o chod míň a pod dezertem zůstávala prázdná plocha. */}
              <p className="menu-alergeny">
                Speciální stravovací požadavky (vegetariánské, veganské či
                zdravotní) nám prosím napište nejpozději do 1.&nbsp;8.&nbsp;2027.
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Pod knihou, ne na desce — tam by soupeřila se zlatým názvem. */}
      <p className="menu-napoveda">{otevrene ? "Klepnutím zavřete" : "Klikněte pro otevření"}</p>
    </div>
  );
}
/* Program dne jako časová osa. `ikona` je název souboru v public/program,
   který z kreseb vyrábí scripts/program-ikony.mjs. Kresby přibývají postupně —
   dokud pro bod žádná není, obrázek se sám schová (viz onError) a zůstane po
   něm prázdné místo, ne rozbitá ikona. */
/* Za jednopísmennými předložkami a spojkami je nezlomitelná mezera (\u00a0),
   ať „v“ nebo „a“ nezůstane viset na konci řádku. */
const PROGRAM = [
  { cas: "9:00", nazev: "Snídaně", ikona: "snidane", misto: "U\u00a0ženicha a\u00a0nevěsty",
    popis: "Poslední klidné sousto předtím, než to celé začne." },
  { cas: "12:00", nazev: "Obřad", ikona: "obrad", misto: "U\u00a0zvoničky v\u00a0Rekovicích",
    popis: "Tady si řekneme své „ano“. Kapesníčky doporučujeme mít po ruce." },
  { cas: "13:30", nazev: "Přípitek a\u00a0svatební oběd", ikona: "obed",
    popis: "Na zdraví, na lásku a\u00a0na pořádný hlad." },
  { cas: "15:30", nazev: "Krájení dortu", ikona: "dort",
    popis: "První společný řez. Nůž držíme oba, vinu neseme napůl." },
  { cas: "16:30", nazev: "První tanec", ikona: "tanec",
    popis: "Jeden tanec a\u00a0žádné záruky elegance." },
  { cas: "Odpoledne", nazev: "Svatební odpoledne", ikona: "odpoledne",
    popis: "Dobré jídlo, sklenka v\u00a0ruce a\u00a0čas užít si den naplno." },
  { cas: "Od 19:00", nazev: "Večerní párty", ikona: "party",
    popis: "Boty dolů, hudbu nahoru." },
];

function CasovaOsa() {
  return (
    <ol className="osa">
      {PROGRAM.map((b) => (
        <li key={b.nazev} className="osa-bod">
          <span className="osa-ikona">
            <img
              loading="lazy"
              decoding="async"
              src={`/program/${b.ikona}.webp`}
              alt=""
              aria-hidden="true"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          </span>
          <span className="osa-cas"><b>{b.cas}</b></span>
          <span className="osa-nazev">{b.nazev}</span>
          {b.misto && <span className="osa-misto">{b.misto}</span>}
          <span className="osa-popis">{b.popis}</span>
        </li>
      ))}
    </ol>
  );
}
/* Obálka s příběhem: dva stavy, jedno otevření. Dřív měla tři (dopis →
   oznámení → zavřeno) a host nevěděl, co klepnutí udělá. */
function ObalkaPribeh({ children }: { children: React.ReactNode }) {
  const [otevrena, setOtevrena] = useState(false);
  return (
    <div className={"obalka" + (otevrena ? " je-otevrena" : "")}>
      {/* Papír stojí nad obálkou v běžném toku. Jeho výška se animuje přes
          grid-template-rows 0fr → 1fr a záporný spodní okraj natáhne obálku
          přes spodek papíru, takže papír končí schovaný v kapse. Klepnutí na
          otevřený papír obálku zase zavře. */}
      <div className="obalka-vysuv" onClick={() => setOtevrena(false)}>
        <div className="obalka-vysuv-ram">
          <div className="obalka-listy">
            <div className="obalka-papir">{children}</div>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="obalka-telo"
        onClick={() => setOtevrena(!otevrena)}
        aria-expanded={otevrena}
        aria-label={otevrena ? "Zavřít dopis" : "Otevřít dopis s naším příběhem"}
      >
        <img loading="lazy" decoding="async" className="obalka-vrstva obalka-zadek" src="/obalka/otevrena-zadek.webp" alt="" aria-hidden="true" />
        <img loading="lazy" decoding="async" className="obalka-vrstva obalka-predek" src="/obalka/otevrena-predek.webp" alt="" aria-hidden="true" />
        {/* Zavřená obálka i s pečetí je jeden celek: pečeť sedí ve špičce
            chlopně, takže musí mizet spolu s ní. */}
        <span className="obalka-zavrena-obal" aria-hidden="true">
          <img loading="lazy" decoding="async" className="obalka-vrstva obalka-zavrena" src="/obalka/zavrena.webp" alt="" />
          <img loading="lazy" decoding="async" className="obalka-pecet" src="/obalka/vosk.webp" alt="" />
        </span>
      </button>
    </div>
  );
}

/* Úvodní obrazovka se zlatým prstenem. Svůj stav drží sama: klepnutí na prsten
   ani její zmizení tak nepřekreslí celou stránku — dřív seděl stav v Home
   a obojí v tu chvíli znovu vykreslilo všechny sekce webu a prolínání cukalo.
   Text v úvodu se rozsvítí přes CSS podle .loader-hide (sourozenec v DOM). */
function UvodniObrazovka() {
  // loading → done (loader se prolíná pryč, web odemčený)
  const [stage, setStage] = useState<"loading" | "done">("loading");
  const [quote, setQuote] = useState<string | null>(null);
  // po doznění fade-outu se obsah loaderu odmountuje — jinak by three.js
  // prsten (requestAnimationFrame + WebGL) zůstal v paměti celou návštěvu
  const [loaderGone, setLoaderGone] = useState(false);

  useEffect(() => {
    setQuote(LOTR_QUOTES[Math.floor(Math.random() * LOTR_QUOTES.length)]);
  }, []);

  /* Dovnitř se jde klepnutím na prsten, ne po odpočtu — úvodní obrazovka
     tak počká, dokud host sám nechce dál. */
  const vstup = () => {
    if (stage !== "loading") return;
    setStage("done");
    // 1s = rezerva na .9s opacity transition loaderu; teprve pak obsah
    // odmountujeme
    setTimeout(() => setLoaderGone(true), 1000);
  };

  // dokud je na obrazovce loader, stránka pod ním nescrolluje
  useEffect(() => {
    document.body.style.overflow = stage === "done" ? "" : "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [stage]);

  // Prázdný obal zůstává v DOM: podle jeho .loader-hide se rozsvítí úvod.
  if (loaderGone) return <div className="loader loader-hide loader-pryc" aria-hidden="true" />;

  /* Klepnout jde kamkoli, nejen na prsten — kdo netrefí kroužek o 170 px,
     zůstal by na úvodní obrazovce stát a dál se nedostal. Tlačítko pod
     prstenem zůstává kvůli klávesnici a čtečkám; jeho klepnutí probublá
     na obal, ale vstup() druhé volání ignoruje. */
  return (
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
        <Ring3D zastaveno={stage !== "loading"} />
      </button>
      {quote && <p className="loader-quote">{quote}</p>}
      <p className="loader-vyzva">Klepněte</p>
    </div>
  );
}

export default function Home() {
  useZaostreniSekci();
  const poSvatbe = usePoSvatbe();

  return (
    <>
      <UvodniObrazovka />

      {/* fullscreen hero — fotka přes celou obrazovku, bez hlavičky */}
      <section className="hero-full" id="hero">
        <img className="hero-bg" fetchPriority="high" src="/fotky/kaplicka.jpg" alt="Kaplička" />
        <div className="hero-content">
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
        <Reveal className="wrap">
          <p className="eyebrow">Náš příběh</p>
          <h2>Jak to celé začalo</h2>
        </Reveal>
        {/* Fotky vlevo, obálka vpravo dole přes roh hromádky, kolem věnec. */}
        <Reveal className="scena">
          {/* Věnec ze svatebních květin — přesně těch, které budou na svatbě
              (předloha z public/kytky u obalky, scripts/kytky-venec.mjs). Obě
              vrstvy leží POD fotkami i obálkou: květy jen vykukují zpoza
              okrajů, přes tváře ani dopis nic neleží. */}
          <img loading="lazy" decoding="async" className="scena-venec" src="/kytky/venec-pod.webp" alt="" aria-hidden="true" />
          <img loading="lazy" decoding="async" className="scena-venec scena-venec-nad" src="/kytky/venec-nad.webp" alt="" aria-hidden="true" />
          <div className="scena-foto">
            <FotoHromadka fotky={PRIBEH_FOTKY} />
          </div>
          <div className="scena-obalka">
            <ObalkaPribeh>
              <p className="lead">
                Pět let spolu, jedno zásnubní „ano“ na Troskách a teď nás čeká naše
                největší společné dobrodružství. Poznali jsme se, zamilovali se,
                prošli spolu krásnými i náročnějšími chvílemi a vybudovali domov
                plný smíchu, lásky a společných vzpomínek. Dnes už víme, že chceme
                jít životem bok po boku — a proto si 18. září 2027 řekneme své „ano“.
              </p>
            </ObalkaPribeh>
          </div>
          {/* Pokyn pod věncem, ve sloupci obálky — pod ní samotnou leží krásenky
              a písmo by se v nich ztrácelo. */}
          <span className="scena-pokyn" aria-hidden="true">
            <span className="scena-pokyn-otevrit">otevřete dopis</span>
            <span className="scena-pokyn-zavrit">zavřít dopis</span>
          </span>
        </Reveal>
      </section>

      {/* místo */}
      <section className="location" id="location">
        <Reveal className="wrap location-wrap">
          {/* Text vlevo, mapa vpravo. Celý web jinak staví všechno na střed pod
              sebe; tahle sekce ten rytmus jednou přeruší, aby stránka nebyla
              sedmkrát za sebou stejná. Ubytování pod tím zůstává přes celou
              šířku, je to samostatný krok. */}
          <div className="location-radek">
          <div className="location-text">
          <p className="eyebrow">Kde se to stane</p>
          <h2>Místo konání</h2>
          {/* Jméno místa stojí natvrdo pod nadpisem. Dřív se objevovalo jen na
              chvíli místo adresy, když host otočil mapu — kdo ji neotočil, název
              hotelu nikde nenašel. Proto je teď vidět pořád a mapa se otáčí bez
              toho, aby text pod ní přepínala. */}
          <p className="venue-nazev">Hotel Rekovice</p>
          <p className="lead venue-address">
            Trojanovice 2 · 744 01 Trojanovice-Frenštát pod Radhoštěm
          </p>
          {/* pro ty, kdo si adresu vkládají do vlastní navigace nebo posílají dál */}
          <Kopirovat className="venue-kopirovat" text={VENUE_ADDRESS} popisek="Kopírovat adresu" />
          <VenueAkce />
          </div>
          <div className="location-mapa">
            <MapaNaDohled />
          </div>
          </div>
          <Ubytovani />
        </Reveal>
      </section>

      {/* program */}
      <section className="schedule" id="schedule">
        {/* Jediná kytice sekce, vlevo nahoře a uvnitř pruhu — menu pod ním má
            svou vpravo dole. */}
        <img loading="lazy" decoding="async" className="program-kytice program-kytice-vlevo" src="/kytky/kytice_program_vlevo.webp?v=4" alt="" aria-hidden="true" />
        <Reveal className="wrap">
          <p className="eyebrow">Nahlédněte</p>
          <h2>Program dne</h2>
        </Reveal>
        <Reveal>
          <CasovaOsa />
        </Reveal>
      </section>

      {/* menu */}
      <section className="menu" id="menu">
        {/* Jediná kytice sekce, vpravo dole — program má svou vlevo nahoře. */}
        <img loading="lazy" decoding="async" className="program-kytice menu-kytice" src="/kytky/kytice_program_vpravo.webp?v=4" alt="" aria-hidden="true" />
        <Reveal className="wrap">
          <p className="eyebrow">Dobrou chuť</p>
          <h2>Svatební menu</h2>
        </Reveal>
        <Reveal>
          <SvatebniMenu />
        </Reveal>
      </section>

      {/* Rozcestník na galerii fotek. Bez něj se na /fotky dalo dostat jen
         přes QR kódy na stolech — po svatbě, až kódy nikdo mít nebude, by
         byla stránka z webu nedosažitelná. */}
      <section className="fotky-odkaz" id="fotky">
        {/* Kytice po stranách. Každá má vlastní obrázek s hotovou kompozicí,
            takže se neotáčí ani nezrcadlí. Schválně přesahují nahoru i dolů
            mimo béžový pruh. */}
        <img loading="lazy" decoding="async" className="fotky-kytice fotky-kytice-vlevo" src="/kytky/kytice_fotky_vlevo.webp" alt="" aria-hidden="true" />
        <img loading="lazy" decoding="async" className="fotky-kytice fotky-kytice-vpravo" src="/kytky/kytice_fotky_vpravo.webp" alt="" aria-hidden="true" />
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
          {DOTAZY.map(({ q, a, barvy, kontakty, obrazek }) => (
            <Dotaz key={q} q={q} a={a} barvy={barvy} kontakty={kontakty} obrazek={obrazek} />
          ))}
        </Reveal>
      </section>

      <footer>
        {/* Béžový pruh přes celé okno a na něm medailonek: fotka zvoničky
           v kolečku s bílým rámečkem. Uzavírá stránku tím, čím začala. */}
        <div className="paticka-pas">
          <div className="paticka-kolecko">
            <p className="paticka-jmena">Kateřina &amp; Jakub</p>
            <p className="paticka-datum">18 · 09 · 2027</p>
            <p className="paticka-vzkaz">Těšíme se na vás</p>
          </div>
        </div>
        <div className="akce-radek paticka-sdilet">
          <SdiletWeb />
        </div>
      </footer>

        {/* Boční květinové pruhy, motýli i světlý pruh středem tu byli do doby,
            než se pozadí změnilo na bílé. Středový pruh byl vidět jen proto, že
            okolí bylo ztmavené na béžovou — na bílém podkladu nemá co odlišovat,
            a květiny bez něj lezly do textu. Komponenta app/Motyli.tsx i všechny
            styly zůstávají, jen se nevykreslují. */}
      </div>
    </>
  );
}
