"use client";

import { useEffect, useRef } from "react";
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

export default function VenueMap() {
  const containerRef = useRef<HTMLDivElement>(null);

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

  // statický náhled (kde to je) + dvě akce: zobrazit detail / navigovat
  return (
    <div className="venue-map">
      <div ref={containerRef} style={{ width: "100%", height: "100%", pointerEvents: "none" }} />
      <div className="venue-map-actions">
        <a href={VENUE_MAP_URL} target="_blank" rel="noopener">
          Zobrazit v mapách
        </a>
        <a href={VENUE_NAV_URL} target="_blank" rel="noopener" className="primary">
          Navigovat
        </a>
      </div>
    </div>
  );
}
