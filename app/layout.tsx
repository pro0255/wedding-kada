import type { Metadata } from "next";
import { Caveat, Cormorant_Garamond, Jost } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Kateřina & Jakub — Svatba",
  description: "Bereme se — a chceme vás u toho.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body className={`${serif.variable} ${sans.variable} ${rukopis.variable}`}>{children}</body>
    </html>
  );
}
