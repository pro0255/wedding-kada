"use client";

import { useEffect, useId, useRef, useState } from "react";
import { NAVIGACE, SVATBA_END, SVATBA_NAZEV, SVATBA_START, VENUE_ADDRESS } from "./venue";

/* Drobné akce pro hosty: přidat do kalendáře, navigovat, zkopírovat, sdílet.
   Všechno jsou to tlačítka ve stejném stylu jako odkazy pod mapou, jen
   s malým rozbalovacím menu, kde je víc možností. */

type Polozka = { nazev: string; href: string; download?: boolean };

/* Tlačítko, které rozbalí seznam odkazů. Zavře se klepnutím mimo, Escapem
   i vybráním položky. Menu je pod tlačítkem, na úzkém displeji se vejde,
   protože má max-width dané rodičem. */
export function VyberMenu({
  popisek,
  polozky,
  primary,
  vzhled = "tlacitko",
  ikona,
  className = "",
}: {
  popisek: string;
  polozky: Polozka[];
  primary?: boolean;
  /* „odkaz“ = bez rámečku, jen text s linkou (pod odpočtem) */
  vzhled?: "tlacitko" | "odkaz";
  ikona?: React.ReactNode;
  className?: string;
}) {
  const [otevreno, setOtevreno] = useState(false);
  const obal = useRef<HTMLDivElement>(null);
  const seznam = useRef<HTMLUListElement>(null);
  // Výška se animuje v px jako u FAQ — do `auto` se plynule nedá; bez toho
  // obsah pod tlačítkem poskočil o celý řádek naráz.
  const [vyska, setVyska] = useState(0);
  const id = useId();

  useEffect(() => {
    const zmer = () => setVyska(otevreno ? seznam.current?.scrollHeight ?? 0 : 0);
    zmer();
    if (!otevreno) return;
    window.addEventListener("resize", zmer);
    return () => window.removeEventListener("resize", zmer);
  }, [otevreno]);

  useEffect(() => {
    if (!otevreno) return;
    const mimo = (e: PointerEvent) => {
      if (!obal.current?.contains(e.target as Node)) setOtevreno(false);
    };
    const klavesa = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOtevreno(false);
    };
    document.addEventListener("pointerdown", mimo);
    document.addEventListener("keydown", klavesa);
    return () => {
      document.removeEventListener("pointerdown", mimo);
      document.removeEventListener("keydown", klavesa);
    };
  }, [otevreno]);

  return (
    <div ref={obal} className={`vyber ${otevreno ? "je-otevreny" : ""} ${className}`}>
      <button
        type="button"
        className={vzhled === "odkaz" ? "akce-odkaz" : `akce-tlacitko ${primary ? "primary" : ""}`}
        aria-haspopup="menu"
        aria-expanded={otevreno}
        aria-controls={id}
        onClick={() => setOtevreno((o) => !o)}
      >
        {ikona}
        {popisek}
        <span className="vyber-sipka" aria-hidden="true" />
      </button>
      <div className="vyber-obal" style={{ height: vyska }} aria-hidden={!otevreno}>
        <ul id={id} ref={seznam} role="menu" className="vyber-menu">
          {polozky.map((p) => (
            <li key={p.nazev} role="none">
              <a
                role="menuitem"
                href={p.href}
                target={p.download ? undefined : "_blank"}
                rel="noopener"
                download={p.download ? "" : undefined}
                tabIndex={otevreno ? 0 : -1}
                onClick={() => setOtevreno(false)}
              >
                {p.nazev}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* Odkaz do Google Kalendáře je hotové URL; Apple, Outlook i Android berou
   .ics z /api/kalendar. Outlook.com má vlastní odkaz, ať se nemusí importovat. */
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/* Kreslený kalendářík se srdíčkem místo čísla — stejná ruka jako doodly
   u příběhu: jen obrys, kulaté konce tahů. */
function KalendarikIkona() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 6.2 C4.5 5.3 5.2 4.8 6 4.8 L18 4.8 C18.9 4.8 19.5 5.4 19.5 6.3 L19.4 18.6 C19.4 19.5 18.8 20.1 17.9 20.1 L6.1 20.2 C5.2 20.2 4.6 19.5 4.6 18.6 Z" />
        <path d="M4.7 9.3 L19.3 9.3" />
        <path d="M8.3 3.2 L8.3 6.4" />
        <path d="M15.7 3.2 L15.7 6.4" />
        <path className="kal-srdce" d="M12 17.2 C10.6 16.1 9.1 15 9.1 13.6 C9.1 12.7 9.8 12.1 10.6 12.1 C11.2 12.1 11.7 12.4 12 12.9 C12.3 12.4 12.8 12.1 13.4 12.1 C14.2 12.1 14.9 12.7 14.9 13.6 C14.9 15 13.4 16.1 12 17.2 Z" />
      </g>
    </svg>
  );
}

export function PridatDoKalendare({ className = "" }: { className?: string }) {
  // origin až v prohlížeči — na serveru není a odkaz by měl špatný web v popisu
  const [web, setWeb] = useState("");
  useEffect(() => setWeb(location.origin), []);

  const popis = `Obřad ve 12:00 u zvoničky v Rekovicích. Program a podrobnosti: ${web}`;
  const google =
    "https://calendar.google.com/calendar/render?" +
    new URLSearchParams({
      action: "TEMPLATE",
      text: SVATBA_NAZEV,
      dates: `${utc(SVATBA_START)}/${utc(SVATBA_END)}`,
      details: popis,
      location: VENUE_ADDRESS,
    });
  const outlook =
    "https://outlook.live.com/calendar/0/action/compose?" +
    new URLSearchParams({
      rru: "addevent",
      subject: SVATBA_NAZEV,
      startdt: SVATBA_START.toISOString(),
      enddt: SVATBA_END.toISOString(),
      body: popis,
      location: VENUE_ADDRESS,
    });

  return (
    <VyberMenu
      className={className}
      vzhled="odkaz"
      ikona={<KalendarikIkona />}
      popisek="Poznamenat si datum"
      polozky={[
        { nazev: "Google Kalendář", href: google },
        { nazev: "Apple Kalendář (.ics)", href: "/api/kalendar", download: true },
        { nazev: "Outlook.com", href: outlook },
        { nazev: "Jiný kalendář (.ics)", href: "/api/kalendar", download: true },
      ]}
    />
  );
}

export function Navigace({ className = "" }: { className?: string }) {
  return <VyberMenu className={className} popisek="Navigovat" polozky={NAVIGACE} primary />;
}

/* Zkopíruje text a na chvíli ukáže potvrzení přímo v tlačítku — bez
   samostatného toastu, host se dívá právě tam, kam klepl. */
export function Kopirovat({
  text,
  popisek,
  hotovo = "Zkopírováno",
  className = "",
}: {
  text: string;
  popisek: string;
  hotovo?: string;
  className?: string;
}) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(false), 1800);
    return () => clearTimeout(t);
  }, [ok]);

  async function kopiruj() {
    try {
      await navigator.clipboard.writeText(text);
      setOk(true);
    } catch {
      // starší prohlížeč bez Clipboard API (nebo bez https) — přes skryté pole
      const pole = document.createElement("textarea");
      pole.value = text;
      pole.style.position = "fixed";
      pole.style.opacity = "0";
      document.body.append(pole);
      pole.select();
      const slo = document.execCommand("copy");
      pole.remove();
      if (slo) setOk(true);
    }
  }

  return (
    <button
      type="button"
      className={`kopirovat ${ok ? "je-hotovo" : ""} ${className}`}
      onClick={kopiruj}
      aria-live="polite"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {ok ? (
          <path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
            <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
          </g>
        )}
      </svg>
      <span>{ok ? hotovo : popisek}</span>
    </button>
  );
}

/* Sdílení webu: na telefonu nativní panel (Messenger, WhatsApp…), jinde se
   odkaz zkopíruje. */
export function SdiletWeb({ className = "" }: { className?: string }) {
  const [umiSdilet, setUmiSdilet] = useState(false);
  useEffect(() => setUmiSdilet(typeof navigator !== "undefined" && "share" in navigator), []);

  const ikona = (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="17.5" cy="5.5" r="2.3" />
        <circle cx="6.5" cy="12" r="2.3" />
        <circle cx="17.5" cy="18.5" r="2.3" />
        <path d="M8.6 10.9 L15.4 6.7" />
        <path d="M8.6 13.1 L15.4 17.3" />
      </g>
    </svg>
  );

  if (umiSdilet) {
    return (
      <button
        type="button"
        className={`akce-odkaz ${className}`}
        onClick={() =>
          navigator
            .share({ title: SVATBA_NAZEV, text: "Bereme se — a chceme vás u toho.", url: location.href.split("#")[0] })
            .catch(() => {
              /* host panel zavřel */
            })
        }
      >
        {ikona}
        Sdílet web
      </button>
    );
  }
  return (
    <Kopirovat
      className={`akce-odkaz ${className}`}
      text={typeof location === "undefined" ? "" : location.href.split("#")[0]}
      popisek="Kopírovat odkaz na web"
      hotovo="Odkaz zkopírován"
    />
  );
}
