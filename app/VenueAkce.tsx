import { VENUE_MAP_URL } from "./venue";
import { Navigace } from "./Akce";

/* Ve vlastním souboru, ne ve VenueMap.tsx: statický import odtamtud by do
   úvodního bundlu stáhl celé maplibre, i když se mapa načítá líně. */
/* Tlačítka pod adresou, ne pod mapou. Stojí zvlášť, protože v rozvržení sekce
   patří k textu vlevo, kdežto mapa je v pravém sloupci — jedna komponenta by
   je držela pohromadě a do levého sloupce by se nedostala. */
export function VenueAkce() {
  return (
    <div className="venue-map-actions">
      <a href={VENUE_MAP_URL} target="_blank" rel="noopener">
        Zobrazit v mapách
      </a>
      <Navigace />
    </div>
  );
}
