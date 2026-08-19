"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

const VenueMap = dynamic(() => import("./VenueMap"), {
  ssr: false,
  loading: () => <div className="venue-map venue-map-loading" />,
});

import Ring3D from "./Ring3D";

const ENVELOPE_KEY = "kj-envelope-opened";

const GALLERY = [
  { src: "/assets/kada-hrad.jpg", alt: "Zásnuby na Troskách" },
  { src: "/assets/couple-golden-hour.jpg", alt: "Kateřina a Jakub" },
  { src: "/assets/kada-husky.jpg", alt: "Zimní procházka" },
];
const LOADER_MS = 5000;

// hlášky z Pána prstenů, lehce svatebně upravené
const LOTR_QUOTES = [
  "Jeden prsten vládne všem. Od 06. 06. 2027 budou dva.",
  "Kouzelník nikdy nechodí pozdě. Tahle svatba taky ne.",
  "You shall not pass!… teda, bez pozvánky.",
  "Ani Frodo nenesl nic tak vzácného, jako jsou tyhle prstýnky.",
  "I ten nejmenší prsten může změnit celý příběh.",
  "Moje rozhodnutí. Můj poklad. 💍",
];

// TODO: skutečné datum svatby
const WEDDING_DATE = new Date("2027-06-06T12:00:00+02:00");

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
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 }
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

const pad = (n: number) => String(n).padStart(2, "0");

/* galerie lightbox */
function Lightbox({
  index,
  onClose,
  onMove,
}: {
  index: number;
  onClose: () => void;
  onMove: (dir: 1 | -1) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onMove(1);
      if (e.key === "ArrowLeft") onMove(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, onMove]);

  const photo = GALLERY[index];
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lb-close" aria-label="Zavřít" onClick={onClose}>
        ×
      </button>
      <button
        className="lb-nav lb-prev"
        aria-label="Předchozí"
        onClick={(e) => {
          e.stopPropagation();
          onMove(-1);
        }}
      >
        ‹
      </button>
      <figure onClick={(e) => e.stopPropagation()}>
        <img src={photo.src} alt={photo.alt} />
        <figcaption>{photo.alt}</figcaption>
      </figure>
      <button
        className="lb-nav lb-next"
        aria-label="Další"
        onClick={(e) => {
          e.stopPropagation();
          onMove(1);
        }}
      >
        ›
      </button>
    </div>
  );
}

/* globální zámek: nikdy nejsou vidět dva easter eggy naráz */
let eggLockUntil = 0;
function scheduleEgg(delayMs: number, durationMs: number, fire: () => void) {
  const now = Date.now();
  // když by kolidoval s jiným, počká, až ten zmizí
  const start = Math.max(now + delayMs, eggLockUntil + 400);
  eggLockUntil = start + durationMs;
  return setTimeout(fire, start - now);
}

/* easter egg: polaroid, který vyskočí na hover / tap */
function EggHost({
  children,
  src,
  caption,
  delay = 0,
}: {
  children: React.ReactNode;
  src: string;
  caption: string;
  delay?: number;
}) {
  const [open, setOpen] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  // poprvé vyskočí sám, když sekce najede do viewportu
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let t: ReturnType<typeof setTimeout>;
    let hide: ReturnType<typeof setTimeout>;
    const DURATION = 4000;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          t = scheduleEgg(delay, DURATION, () => {
            setOpen(true);
            hide = setTimeout(() => setOpen(false), DURATION);
          });
          io.disconnect();
        }
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(t);
      clearTimeout(hide);
    };
  }, [delay]);

  return (
    <div
      ref={hostRef}
      className={`egg-host ${open ? "egg-open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
    >
      {children}
      <div className="polaroid" aria-hidden>
        <img src={src} alt="" />
        <span>{caption}</span>
      </div>
    </div>
  );
}

/* easter egg: Luna občas vykoukne od spodního okraje */
function LunaPeek() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let hide: ReturnType<typeof setTimeout>;
    let t: ReturnType<typeof setTimeout>;
    const DURATION = 7000;
    let visible = false;
    // Luna vykoukne, jen když je člověk úplně dole (u patičky)
    const footer = document.querySelector("footer");
    let io: IntersectionObserver | undefined;
    if (footer) {
      io = new IntersectionObserver(
        ([e]) => {
          if (e.isIntersecting && !visible) {
            visible = true;
            t = scheduleEgg(400, DURATION, () => {
              setShow(true);
              hide = setTimeout(() => {
                setShow(false);
                visible = false;
              }, DURATION);
            });
          }
        },
        { threshold: 0.4 }
      );
      io.observe(footer);
    }
    return () => {
      clearTimeout(t);
      clearTimeout(hide);
      io?.disconnect();
    };
  }, []);
  return (
    <button
      type="button"
      className={`luna-peek ${show ? "show" : ""}`}
      onClick={() => setShow((s) => !s)}
      aria-label="Kočka Luna"
    >
      <span className="luna-bubble">Luna to celé schvaluje</span>
      <img src="/assets/luna.jpg" alt="" />
    </button>
  );
}

export default function Home() {
  // loading → closed → opening (běží animace) → done (overlay pryč)
  const [stage, setStage] = useState<"loading" | "closed" | "opening" | "done">("loading");
  // obálka se mountne jen při první návštěvě — žádné bliknutí při opakované
  const [envelopeActive, setEnvelopeActive] = useState(false);
  const [quote, setQuote] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const left = useCountdown(WEDDING_DATE);

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
                <div className="env-card-date">06 · 06 · 2027</div>
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
        {/* TODO: kvalitní společná fotka na výšku/šířku */}
        <img className="hero-bg" src="/assets/couple-golden-hour.jpg" alt="Kateřina a Jakub" />
        <div className="hero-content">
          <p className="hero-eyebrow">Bereme se</p>
          <h1 className="hero-title">Kateřina &amp; Jakub</h1>
          <div className="hero-date">06 · 06 · 2027</div>{/* TODO datum svatby */}
        </div>
        <a className="hero-scroll" href="#countdown" aria-label="Posunout dolů">
          <span />
        </a>
      </section>

      {/* countdown */}
      <section className="countdown" id="countdown">
        <Reveal className="wrap">
          <p className="eyebrow">Odpočítáváme</p>
          <h2>Zbývá</h2>
          <EggHost src="/assets/pluto.jpg" caption="Pluto se už taky nemůže dočkat" delay={2500}>
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
          </EggHost>
        </Reveal>
      </section>

      {/* příběh */}
      <section id="story">
        <Reveal className="wrap">
          <p className="eyebrow">Náš příběh</p>
          <h2>Jak to celé začalo</h2>
          <p className="lead">
            {/* TODO skutečný příběh */}
            Pět let spolu, jedno zásnubní „ano“ na Troskách — a teď to velké.
            Sem přijde pár vět o tom, jak jsme se potkali a proč jsme se rozhodli
            udělat ten velký krok.
          </p>
          <div className="story-photo">
            <img src="/assets/couple-golden-hour.jpg" alt="Kateřina a Jakub" />
          </div>
        </Reveal>
      </section>

      {/* kdo jsme */}
      <section id="people" style={{ paddingTop: 0 }}>
        <Reveal className="wrap">
          <p className="eyebrow">Snoubenci</p>
          <h2>Kdo jsme</h2>
        </Reveal>
        <Reveal className="people">
          <div className="person">
            <img src="/assets/kada-hrad.jpg" alt="Nevěsta Kateřina" />
            <h3>Kateřina</h3>
            <div className="role">Nevěsta</div>
            <p>{/* TODO bio nevěsty */}Miluje hory, hrady a svého psa. Krátké bio doplníme.</p>
          </div>
          <div className="person">
            <img src="/assets/jakub.jpg" alt="Ženich Jakub" />
            <h3>Jakub</h3>
            <div className="role">Ženich</div>
            <p>{/* TODO bio ženicha */}Krátké bio Jakuba doplníme, až budou texty a fotky.</p>
          </div>
        </Reveal>
      </section>

      {/* program (dark) */}
      <section className="schedule" id="schedule">
        <Reveal className="wrap">
          <p className="eyebrow">Nahlédněte</p>
          <h2>Program dne</h2>
          <div className="slots">
            {/* TODO časy */}
            <div className="slot">
              <b>12:00</b>
              <span>Obřad</span>
            </div>
            <div className="slot">
              <b>13:30</b>
              <span>Přípitek &amp; raut</span>
            </div>
            <div className="slot">
              <b>17:00</b>
              <span>Večeře</span>
            </div>
            <div className="slot">
              <b>20:00</b>
              <span>Hudba &amp; tanec</span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* průběh */}
      <section id="events">
        <Reveal className="wrap">
          <p className="eyebrow">Co vás čeká</p>
          <h2>Průběh dne</h2>
        </Reveal>
        <Reveal className="events">
          <EggHost src="/assets/maximilian.jpg" caption="Prstýnky hlídá Maxík — ministr prstýnků">
            <div className="event">
              <div className="num">01</div>
              <div>
                <h3>Obřad</h3>
                <div className="meta">12:00 · Místo TBD</div>
                <p>Slavnostní „ano“ pod širým nebem. Detaily doplníme.</p>
              </div>
            </div>
          </EggHost>
          <div className="event">
            <div className="num">02</div>
            <div>
              <h3>Přípitek &amp; focení</h3>
              <div className="meta">13:30 · Zahrada</div>
              <p>Skleničku do ruky, úsměv do objektivu.</p>
            </div>
          </div>
          <div className="event">
            <div className="num">03</div>
            <div>
              <h3>Hostina &amp; party</h3>
              <div className="meta">17:00 · Sál</div>
              <p>Večeře, proslovy, tanec — a možná i půlnoční překvapení.</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* místo */}
      <section className="location" id="location">
        <Reveal className="wrap">
          <p className="eyebrow">Kde se to stane</p>
          <h2>Místo konání</h2>
          <p className="lead">{/* TODO název místa */}Úzká · Ostrava</p>
          <VenueMap />
        </Reveal>
      </section>

      {/* galerie */}
      <section id="gallery">
        <Reveal className="wrap">
          <p className="eyebrow">Naše momenty</p>
          <h2>Galerie</h2>
        </Reveal>
        <Reveal className="grid">
          {GALLERY.map((p, i) => (
            <img key={p.src} src={p.src} alt={p.alt} onClick={() => setLightbox(i)} />
          ))}
        </Reveal>
      </section>

      <footer>Kateřina &amp; Jakub · 2027 · Těšíme se na vás</footer>

      <LunaPeek />

      {lightbox !== null && (
        <Lightbox
          index={lightbox}
          onClose={() => setLightbox(null)}
          onMove={(dir) => setLightbox((i) => ((i ?? 0) + dir + GALLERY.length) % GALLERY.length)}
        />
      )}
    </>
  );
}
