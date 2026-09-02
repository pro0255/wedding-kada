export const VENUE_ADDRESS = "Trojanovice 2, 744 01 Trojanovice-Frenštát pod Radhoštěm";
export const VENUE_COORDS: [number, number] = [49.5381611, 18.1934009];
// „kde to je" — detail místa na mapy.com
export const VENUE_MAP_URL =
  "https://mapy.com/zakladni?x=18.1934009&y=49.5381611&z=17&source=coor&id=18.1934009%2C49.5381611";
// „jak se tam dostanu" — navigace z aktuální polohy (na mobilu otevře nativní aplikaci)
export const VENUE_NAV_URL =
  "https://www.google.com/maps/dir/?api=1&destination=49.5381611,18.1934009";

// web hotelu — ověřeno 2. 9. 2026 (titulek „Hotel Rekovice | Nová cesta k tradici“)
export const VENUE_WEB_URL = "https://www.rekovice.cz";

/* Navigace ve víc aplikacích. Host si vybere tu, kterou má v telefonu —
   samotný Google odkaz na iPhonu bez Google Maps skončil v prohlížeči. */
const LAT = VENUE_COORDS[0];
const LON = VENUE_COORDS[1];
export const NAVIGACE: { nazev: string; href: string }[] = [
  { nazev: "Mapy.cz", href: `https://mapy.com/fnc/v1/route?mapset=basic&end=${LON},${LAT}` },
  { nazev: "Google Maps", href: VENUE_NAV_URL },
  { nazev: "Apple Maps", href: `https://maps.apple.com/?daddr=${LAT},${LON}&dirflg=d` },
  { nazev: "Waze", href: `https://waze.com/ul?ll=${LAT},${LON}&navigate=yes` },
];

/* Událost do kalendáře. Začátek = obřad (12:00), konec = začátek večerní
   párty + pár hodin; celý den by v kalendáři zakryl i snídani. */
export const SVATBA_START = new Date("2027-09-18T12:00:00+02:00");
export const SVATBA_END = new Date("2027-09-18T23:00:00+02:00");
export const SVATBA_NAZEV = "Svatba Kateřina & Jakub";
