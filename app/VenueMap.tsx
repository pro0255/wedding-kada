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

export default function VenueMap() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MaplibreMap({
      container: containerRef.current,
      // stejný styl jako CARTO light_all (Positron), ale zdarma a bez API klíče
      style: "https://tiles.openfreemap.org/styles/positron",
      center: [VENUE[1], VENUE[0]], // maplibre je [lng, lat]
      zoom: 15,
      interactive: false,
      attributionControl: false,
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
