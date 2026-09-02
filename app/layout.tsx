import type { Metadata, Viewport } from "next";
import { Caveat, Cormorant_Garamond, Jost } from "next/font/google";
import "./globals.css";
import ServiceWorker from "./ServiceWorker";

const serif = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--serif",
});

const sans = Jost({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500"],
  variable: "--sans",
});

// rukopis pro ručně psané doodly u „Náš příběh“
const rukopis = Caveat({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  variable: "--rukopis",
});

/* Absolutní adresa pro OG obrázek a odkazy ve sdílení. Na Vercelu se bere
   produkční doména z prostředí; lokálně localhost. */
const web = process.env.NEXT_PUBLIC_WEB_URL
  ? process.env.NEXT_PUBLIC_WEB_URL
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(web),
  title: "Kateřina & Jakub — Svatba",
  description: "Bereme se — a chceme vás u toho. 18. 9. 2027 u zvoničky v Rekovicích.",
  /* náhled při sdílení do Messengeru, WhatsAppu…; obrázek dodá app/opengraph-image.tsx */
  openGraph: {
    type: "website",
    locale: "cs_CZ",
    siteName: "Svatba Kateřina & Jakub",
    title: "Kateřina & Jakub — Svatba",
    description: "Bereme se — a chceme vás u toho. 18. 9. 2027 u zvoničky v Rekovicích.",
  },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: "Svatba K & J", statusBarStyle: "default" },
  icons: { apple: "/ikony/apple-180.png" },
};

export const viewport: Viewport = { themeColor: "#f5f2ec" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body className={`${serif.variable} ${sans.variable} ${rukopis.variable}`}>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
