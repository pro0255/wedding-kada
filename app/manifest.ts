import type { MetadataRoute } from "next";

/* Web app manifest — díky němu jde web „přidat na plochu“ a otevře se bez
   lišty prohlížeče. Ikony jsou rastrované z app/icon.svg (viz public/ikony). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Svatba Kateřina & Jakub",
    short_name: "Svatba K & J",
    description: "Bereme se — a chceme vás u toho. 18. 9. 2027, Rekovice.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "cs",
    background_color: "#f5f2ec",
    theme_color: "#f5f2ec",
    icons: [
      { src: "/ikony/ikona-192.png", sizes: "192x192", type: "image/png" },
      { src: "/ikony/ikona-512.png", sizes: "512x512", type: "image/png" },
      { src: "/ikony/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
