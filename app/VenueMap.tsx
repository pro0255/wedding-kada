"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MaplibreMap, Marker, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { VENUE_COORDS as VENUE, VENUE_MAP_URL, VENUE_NAV_URL } from "./venue";

// Turbopack rozbije cestu k maplibre workeru (import.meta.url míří do chunku),
// worker se tiše nespustí a mapa zůstane prázdná. Proto kopie workeru
// v /public — při upgradu maplibre-gl je nutné zkopírovat znovu:
// cp node_modules/maplibre-gl/dist/maplibre-gl-{worker,shared}.mjs public/
setWorkerUrl("/maplibre-gl-worker.mjs");

/* Vychází z barev výchozích Google Maps, se dvěma odchylkami: zeleň je
   posunutá k naší šalvějové (--zelena #b7d3ab zesvětlená), ať mapa ladí se
   sekcí, a cesty jsou šedé, zatímco stavení bílá. */
const BARVY = {
  zem: "#f2f0ec",
  zelen: "#dcebd0",
  les: "#d0e3c2",
  voda: "#a9d3e8",
  // stavení bílá, cesty šedé — obráceně, než to má Liberty i Google
  budova: "#ffffff",
  silnice: "#d8d8d3",
  silniceLem: "#bdbdb7",
  dalnice: "#c3c3bd",
  dalniceLem: "#a4a49e",
};

/** Jakou barvu má vrstva dostat — rozhoduje se podle id vrstvy Liberty stylu. */
function barvaVrstvy(id: string): string | null {
  if (id === "background") return BARVY.zem;
  if (id.includes("water") || id.startsWith("waterway")) return BARVY.voda;
  if (id.includes("wood") || id.includes("forest")) return BARVY.les;
  if (id.startsWith("landcover") || id.startsWith("landuse") || id.startsWith("park")) return BARVY.zelen;
  if (id.startsWith("building")) return BARVY.budova;
  if (id.includes("motorway") || id.includes("trunk")) {
    return id.includes("casing") ? BARVY.dalniceLem : BARVY.dalnice;
  }
  if (id.startsWith("highway") || id.startsWith("road") || id.startsWith("tunnel") || id.startsWith("bridge")) {
    return id.includes("casing") ? BARVY.silniceLem : BARVY.silnice;
  }
  return null;
}

/* Do které vlastnosti se barva zapisuje — podle typu vrstvy. Vrstvy typu
   symbol (názvy obcí a ulic, čísla silnic, ikonky) se místo barvení rovnou
   schovávají, viz map.on("load") níž. */
const VLASTNOST: Record<string, string> = {
  background: "background-color",
  fill: "fill-color",
  line: "line-color",
  "fill-extrusion": "fill-extrusion-color",
};

export default function VenueMap({ onFlipChange }: { onFlipChange?: (otoceno: boolean) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // tlačítka jsou teď pod rámečkem, mimo kartu, takže na ně otáčení nedosáhne
  const [otoceno, setOtoceno] = useState(false);
  /* Na dotyku žádný hover nevzniká, takže by se karta nikdy neotočila a fotka
     hotelu by byla pro většinu hostů nedostupná. Tam se proto přepíná
     klepnutím a v rohu svítí ikonka, že se dá otočit. */
  const [dotyk, setDotyk] = useState(false);
  const scenaRef = useRef<HTMLDivElement>(null);
  // jakmile host sám klepne, ukázka se už nespouští ani nedokončuje
  const zasahHosta = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    const nastav = () => setDotyk(mq.matches);
    nastav();
    mq.addEventListener("change", nastav);
    return () => mq.removeEventListener("change", nastav);
  }, []);

  /* Karta se po příjezdu do zorného pole jednou sama otočí a vrátí. Text na
     štítku říká, že se dá klepnout, ale ukázat to je silnější než napsat —
     host uvidí na vlastní oči, že má mapa druhou stranu.

     Jen na myši. Na dotyku ji nahrazuje štítek „Klepnutím zobrazíte hotel“,
     který řekne totéž a nehýbe hostovi obsahem pod prstem. S vypnutými
     animacemi se přeskočí. Spustí se jednou za návštěvu a jakmile host sám
     najede myší, zbytek se zruší — jinak by se karta po doběhnutí časovače
     otočila zpátky pod kurzorem, který ji zrovna drží otočenou. */
  useEffect(() => {
    if (dotyk) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = scenaRef.current;
    if (!el) return;

    const casovace: number[] = [];
    const io = new IntersectionObserver(
      (zaznamy) => {
        if (!zaznamy.some((z) => z.isIntersecting)) return;
        io.disconnect();
        casovace.push(
          window.setTimeout(() => {
            if (!zasahHosta.current) setOtoceno(true);
          }, 900),
        );
        casovace.push(
          window.setTimeout(() => {
            if (!zasahHosta.current) setOtoceno(false);
          }, 3000),
        );
      },
      { rootMargin: "0px 0px -25% 0px" },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      casovace.forEach((t) => clearTimeout(t));
    };
  }, [dotyk]);

  useEffect(() => {
    onFlipChange?.(otoceno);
  }, [otoceno, onFlipChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MaplibreMap({
      container: containerRef.current,
      // Liberty místo Positronu — Positron je skoro černobílý a sekce z něj
      // byla mrtvá. Barvy si po načtení stejně přepíšeme na googlovské
      // (viz BARVY níž). Zdarma a bez API klíče.
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [VENUE[1], VENUE[0]], // maplibre je [lng, lat]
      zoom: 15,
      interactive: false,
      attributionControl: false,
    });

    // přebarvení až po načtení stylu — dřív ještě vrstvy neexistují
    map.on("load", () => {
      for (const vrstva of map.getStyle().layers ?? []) {
        // mapa je jen ilustrace „kde to je“, popisky by ji zbytečně zaplevelily
        if (vrstva.type === "symbol") {
          try {
            map.setLayoutProperty(vrstva.id, "visibility", "none");
          } catch {
            /* vrstva se schovat nedá, nevadí */
          }
          continue;
        }
        const vlastnost = VLASTNOST[vrstva.type];
        const barva = vlastnost && barvaVrstvy(vrstva.id);
        if (!vlastnost || !barva) continue;
        // některé vrstvy mají barvu řízenou výrazem a zápis neprojde — přeskoč
        try {
          // název vlastnosti vybíráme podle typu vrstvy, takže je to řetězec —
          // maplibre chce úzký union, proto přetypování
          map.setPaintProperty(
            vrstva.id,
            vlastnost as Parameters<typeof map.setPaintProperty>[1],
            barva
          );
        } catch {
          /* vrstva si barvu nastavit nedá, necháme původní */
        }
      }
    });

    const pinEl = document.createElement("div");
    pinEl.className = "venue-pin";
    pinEl.innerHTML =
      '<span class="venue-pin-dot"></span><span class="venue-pin-ring"></span>';
    const marker = new Marker({ element: pinEl })
      .setLngLat([VENUE[1], VENUE[0]])
      .addTo(map);

    return () => {
      marker.remove();
      map.remove();
    };
  }, []);

  // statický náhled (kde to je) + dvě akce pod ním: zobrazit detail / navigovat.
  // Při najetí myší se karta otočí a odhalí Hotel Rekovice, kde se koná
  // samotný obřad.
  return (
    <>
      <div
        ref={scenaRef}
        className="venue-map-scene"
        onMouseEnter={
          dotyk
            ? undefined
            : () => {
                zasahHosta.current = true;
                setOtoceno(true);
              }
        }
        onMouseLeave={dotyk ? undefined : () => setOtoceno(false)}
        onClick={
          dotyk
            ? () => {
                zasahHosta.current = true;
                setOtoceno((o) => !o);
              }
            : undefined
        }
      >
        <div className={`venue-map${otoceno ? " je-otoceny" : ""}`}>
          <div className="venue-flip-front">
            <div ref={containerRef} style={{ width: "100%", height: "100%", pointerEvents: "none" }} />
          </div>
          <div className="venue-flip-back">
            <img src="/fotky/rekovice.png" alt="Hotel Rekovice" className="venue-flip-photo" />
          </div>
        </div>
        {/* Ikonka stojí mimo otáčející se kartu, aby se neodtočila pryč.
           Vykresluje se jen na dotykových zařízeních (viz CSS) a po otočení
           zmizí — to už host ví, že se karta dá překlopit. Ruka s ukazováčkem
           a paprsky — stejná ikona, jakou lidi znají z „klikni sem“. */}
        <span className={`venue-flip-pokyn${otoceno ? " je-skryty" : ""}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {/* paprsky nad špičkou ukazováčku — „klepni“ */}
              <path d="M11.7 4.6 V1.9" />
              <path d="M9.1 5.3 L7.4 3.1" />
              <path d="M14.3 5.3 L16 3.1" />
              <path d="M7.6 7.5 L4.9 6.7" />
              <path d="M15.8 7.5 L18.5 6.7" />
              {/* ukazováček, dva pokrčené prsty a dlaň se zápěstím */}
              <path d="M10.2 16.4 V7.8 a1.5 1.5 0 0 1 3 0 v4.6" />
              <path d="M13.2 12.4 a1.5 1.5 0 0 1 3 0 v0.9" />
              <path d="M16.2 13.3 a1.5 1.5 0 0 1 3 0" />
              <path d="M19.2 13.3 V17 a4.8 4.8 0 0 1 -4.8 4.8 h-1.7 a4.6 4.6 0 0 1 -3.2 -1.3 L6.4 17.2 a1.6 1.6 0 0 1 2.3 -2.2 l1.5 1.5" />
            </g>
          </svg>
          <span>Klepnutím zobrazíte hotel</span>
        </span>
        {/* Na myši stačí otočku naznačit dvěma šipkami do kruhu — hover ji
           spustí sám, není na co klepat. Ikona ruky by tu byla matoucí. */}
        <span className={`venue-flip-otocka${otoceno ? " je-skryty" : ""}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 10 A7.6 7.6 0 0 1 17.5 6.6" />
              <path d="M13.4 7.4 L17.5 6.6 L16.8 10.7" />
              <path d="M19 14 A7.6 7.6 0 0 1 6.5 17.4" />
              <path d="M10.6 16.6 L6.5 17.4 L7.2 13.3" />
            </g>
          </svg>
        </span>
      </div>
      <div className="venue-map-actions">
        <a href={VENUE_MAP_URL} target="_blank" rel="noopener">
          Zobrazit v mapách
        </a>
        <a href={VENUE_NAV_URL} target="_blank" rel="noopener" className="primary">
          Navigovat
        </a>
      </div>
    </>
  );
}
