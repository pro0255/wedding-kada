"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const VenueMap = dynamic(() => import("./VenueMap"), {
  ssr: false,
  loading: () => <div className="venue-map venue-map-loading" />,
});

import Ring3D from "./Ring3D";
import Ubytovani from "./Ubytovani";

const ENVELOPE_KEY = "kj-envelope-opened";

const LOADER_MS = 5000;

// hlášky z Pána prstenů, lehce svatebně upravené
const LOTR_QUOTES = [
  "Jeden prsten vládne všem. Od 18. 09. 2027 budou dva.",
  "You shall not pass!… teda, bez pozvánky.",
  "Ani Frodo nenesl nic tak vzácného, jako jsou tyhle prstýnky.",
];

// TODO: skutečné datum svatby
const WEDDING_DATE = new Date("2027-09-18T12:00:00+02:00");

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

type Barva = { nazev: string; hex: string };

/* Nejčastější dotazy. Přidávat/mazat se dá rovnou tady — sekce se vykreslí sama.
   TODO: kromě dresscodu jsou odpovědi jen návrh, přepiš je. */
const DOTAZY: { q: string; a: string; barvy?: Barva[] }[] = [
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
    q: "Co si přejete za dar?",
    a: "Nejradši bychom místo věcí, které stejně brzy skončí v šuplíku, přivítali příspěvek do naší společné budoucnosti — svatební kasička bude po ruce. A pokud byste přece jen chtěli něco přinést, mysleli jsme na naše chlupaté kamarády: místo kytice nebo lahve rádi odvezeme granule, deky nebo hračky do jednoho ze dvou útulků, se kterými jsme domluveni.",
  },
];

/* Jeden dotaz. Výšku odpovědi měříme a nastavujeme v px — do `auto` se plynule
   animovat nedá, tak ji po každém přepnutí změříme z obsahu. */
function Dotaz({ q, a, barvy }: { q: string; a: string; barvy?: Barva[] }) {
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
          <p>{a}</p>
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

/* hromádka fotek u „Náš příběh“ — kliknutím se přeloží vrchní fotka dozadu */
const PRIBEH_FOTKY = [
  { src: "/fotky/1.jpeg", alt: "Zásnuby na Troskách" },
  { src: "/fotky/2.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/4.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/6.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/11.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/16.jpeg", alt: "Kateřina a Jakub" },
  { src: "/fotky/20.jpeg", alt: "Kateřina a Jakub" },
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
  const pocet = PRIBEH_FOTKY.length;

  return (
    <button
      type="button"
      className="foto-hromadka"
      onClick={() => setAktivni((i) => (i + 1) % pocet)}
      aria-label="Zobrazit další fotku"
    >
      {PRIBEH_FOTKY.map((foto, i) => {
        const slot = (i - aktivni + pocet) % pocet;
        const viditelny = slot < HROMADKA_SLOTY.length;
        const poloha = HROMADKA_SLOTY[Math.min(slot, HROMADKA_SLOTY.length - 1)];
        return (
          <img
            key={foto.src}
            src={foto.src}
            alt={slot === 0 ? foto.alt : ""}
            className={`foto-list ${slot === 0 ? "foto-vrchni" : ""}`}
            style={{
              transform: `translate(${poloha.x}px, ${poloha.y}px) rotate(${poloha.rot}deg)`,
              zIndex: pocet - slot,
              opacity: viditelny ? 1 : 0,
            }}
          />
        );
      })}
      <span className="foto-pocitadlo">
        {aktivni + 1} / {pocet}
      </span>
    </button>
  );
}

export default function Home() {
  // loading → closed → opening (běží animace) → done (overlay pryč)
  const [stage, setStage] = useState<"loading" | "closed" | "opening" | "done">("loading");
  // obálka se mountne jen při první návštěvě — žádné bliknutí při opakované
  const [envelopeActive, setEnvelopeActive] = useState(false);
  const [quote, setQuote] = useState<string | null>(null);
  const left = useCountdown(WEDDING_DATE);

  // Rozplynutí spodku hero řídí scroll: nahoře je fotka ostrá až k hraně,
  // po ~45 % výšky okna je přechod naplno. Samotné doznívání kreslí CSS.
  useEffect(() => {
    let cekaNaSnimek = false;
    const uprav = () => {
      cekaNaSnimek = false;
      const pomer = Math.min(1, window.scrollY / (window.innerHeight * 0.45));
      document.documentElement.style.setProperty("--hero-fade-pomer", pomer.toFixed(3));
    };
    const naScroll = () => {
      if (cekaNaSnimek) return;
      cekaNaSnimek = true;
      requestAnimationFrame(uprav);
    };
    uprav();
    window.addEventListener("scroll", naScroll, { passive: true });
    window.addEventListener("resize", naScroll);
    return () => {
      window.removeEventListener("scroll", naScroll);
      window.removeEventListener("resize", naScroll);
    };
  }, []);

  useEffect(() => {
    setQuote(LOTR_QUOTES[Math.floor(Math.random() * LOTR_QUOTES.length)]);
    const opened = !!localStorage.getItem(ENVELOPE_KEY);
    const t = setTimeout(() => {
      if (opened) {
        setStage("done");
      } else {
        setEnvelopeActive(true);
        setStage("closed");
      }
    }, LOADER_MS);
    return () => clearTimeout(t);
  }, []);

  // dokud je obálka na obrazovce, stránka pod ní nescrolluje
  useEffect(() => {
    document.body.style.overflow = stage === "done" ? "" : "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [stage]);

  const openEnvelope = () => {
    if (stage !== "closed") return;
    setStage("opening");
    localStorage.setItem(ENVELOPE_KEY, "1");
    setTimeout(() => setStage("done"), 3200);
  };

  return (
    <>
      {/* loading — zlatý prsten + hláška, mezitím se rozhodne obálka vs. web */}
      <div className={`loader ${stage !== "loading" ? "loader-hide" : ""}`} aria-hidden={stage !== "loading"}>
        <div className="loader-brand">K &amp; J</div>
        <Ring3D />
        {quote && <p className="loader-quote">{quote}</p>}
      </div>

      {/* intro obálka — jen při první návštěvě */}
      {envelopeActive && (
      <div
        className={`envelope ${stage !== "closed" ? "opening" : ""} ${stage === "done" ? "open" : ""}`}
        onClick={openEnvelope}
        aria-label="Otevřít pozvánku"
      >
        <div className="env-names">
          Kateřina <span style={{ fontSize: ".6em" }}>&amp;</span> Jakub
        </div>

        <div className="env-scene">
          <div className="env3d">
            <div className="env-shadow" />
            <div className="env-back" />
            <div className="env-card">
              <div className="env-card-inner">
                <div className="env-card-mono">K &amp; J</div>
                <div className="env-card-date">18 · 09 · 2027</div>
                <div className="env-card-note">Zveme vás na naši svatbu</div>
              </div>
            </div>
            <div className="env-pocket" />
            <div className="env-flap">
              <div className="env-flap-face env-flap-front" />
              <div className="env-flap-face env-flap-inside" />
              <div className="wax">K·J</div>
            </div>
          </div>
        </div>

        <div className="env-hint">Klepnutím otevřete pozvánku</div>
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

      {/* od odpočtu níž rámuje obsah tenká linka a dole sedí panorama Beskyd */}
      <div className="obsah-ramec">

      {/* countdown */}
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
        </Reveal>
      </section>

      {/* příběh */}
      <section className="story" id="story">
        <Reveal className="story-grid">
          <div className="story-photo">
            <FotoHromadka />
          </div>
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
          <p className="lead">Trojanovice 2 · 744 01 Trojanovice-Frenštát pod Radhoštěm</p>
          <VenueMap />
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
            <h3>Snídaně</h3>
            <div className="meta">9:00 · U ženicha a nevěsty</div>
            <p>Poslední klidné sousto před tím, než to celé začne.</p>
          </div>
          <div className="event">
            <h3>Obřad</h3>
            <div className="meta">12:00 · U Zvoničky v Rekovicích</div>
            <p>Tady si řekneme své „ano“. Kapesníčky doporučujeme mít po ruce.</p>
          </div>
          <div className="event">
            <h3>Společné focení</h3>
            <div className="meta">13:00</div>
            <p>Chvilka pro novomanžele a pár fotek, které budeme ukazovat ještě za dvacet let.</p>
          </div>
          <div className="event">
            <h3>Přípitek &amp; oběd</h3>
            <div className="meta">13:30</div>
            <p>Na zdraví, na lásku a na pořádný hlad.</p>
          </div>
          <div className="event">
            <h3>První tanec &amp; krájení dortu</h3>
            <div className="meta">15:30</div>
            <p>Jeden tanec, jeden dort a žádné záruky elegance.</p>
          </div>
          <div className="event">
            <h3>Svatební odpoledne</h3>
            <div className="meta">Odpoledne</div>
            <p>Dobré jídlo, sklenka v ruce a čas užít si den naplno.</p>
          </div>
          <div className="event">
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
      </section>

      {/* nejčastější dotazy */}
      <section className="faq" id="faq">
        <Reveal className="wrap">
          <p className="eyebrow">Ptáte se</p>
          <h2>Nejčastější dotazy</h2>
          <p className="lead">Klepnutím na otázku se rozbalí odpověď.</p>
        </Reveal>
        <Reveal className="faq-list">
          {DOTAZY.map(({ q, a, barvy }) => (
            <Dotaz key={q} q={q} a={a} barvy={barvy} />
          ))}
        </Reveal>
      </section>

      <footer>Kateřina &amp; Jakub · 2027 · Těšíme se na vás</footer>

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
