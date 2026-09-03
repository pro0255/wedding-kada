import { SVATBA_END, SVATBA_NAZEV, SVATBA_START, VENUE_ADDRESS } from "../../venue";

/* Soubor .ics pro Apple Calendar, Outlook i Android. Generuje se za běhu,
   aby odkaz na web v popisu odpovídal doméně, ze které si ho host stáhl. */
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// čárky, středníky a nové řádky mají v iCalendar zvláštní význam
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (z) => `\\${z}`).replace(/\n/g, "\\n");

export function GET(req: Request) {
  const web = new URL(req.url).origin;
  const radky = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kateřina & Jakub//Svatba//CS",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:svatba-2027-09-18@${new URL(web).host}`,
    `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(SVATBA_START)}`,
    `DTEND:${utc(SVATBA_END)}`,
    `SUMMARY:${esc(SVATBA_NAZEV)}`,
    `LOCATION:${esc(VENUE_ADDRESS)}`,
    `DESCRIPTION:${esc(`Obřad ve 12:00 u zvoničky v Rekovicích. Program a podrobnosti: ${web}`)}`,
    `URL:${web}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc("Zítra je svatba!")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return new Response(radky.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="svatba-katerina-jakub.ics"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
