import type { Metadata } from "next";
import Oznameni from "./Oznameni";

export const metadata: Metadata = {
  title: "Svatební oznámení · Kateřina & Jakub",
  description: "Tisková verze svatebního oznámení.",
  robots: { index: false, follow: false },
};

/** Svatební oznámení k tisku. Samostatná stránka (bez obálky a loaderu),
    na hlavní stránce záměrně není — slouží jen k vyladění a exportu do PDF. */
export default function OznameniStranka() {
  return <Oznameni />;
}
