"use client";

import { MapContainer, TileLayer, Marker } from "react-leaflet";
import { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { VENUE_COORDS as VENUE, VENUE_MAP_URL, VENUE_NAV_URL } from "./venue";

const pin = divIcon({
  className: "venue-pin-wrap",
  html: '<div class="venue-pin"><span class="venue-pin-dot"></span><span class="venue-pin-ring"></span></div>',
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

export default function VenueMap() {
  // statický náhled (kde to je) + dvě akce: zobrazit detail / navigovat
  return (
    <div className="venue-map">
      <MapContainer
        center={VENUE}
        zoom={15}
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={false}
        touchZoom={false}
        doubleClickZoom={false}
        boxZoom={false}
        keyboard={false}
        attributionControl={false}
        style={{ width: "100%", height: "100%", pointerEvents: "none" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <Marker position={VENUE} icon={pin} />
      </MapContainer>
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
