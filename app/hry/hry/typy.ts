import type { HraSlug } from "@/lib/schemata";

/* Hra je čistý modul bez Reactu: stav, vstup, krok, vykreslení. Obal
   `Hra.tsx` řídí smyčku, plátno, vstupy, zvuk a ukládání skóre.
   Rozměr plátna dává obal podle místa na obrazovce (telefon na výšku
   i na šířku) — hra si ho drží ve stavu. */

export type Barvy = { ink: string; inkJemny: string; zlata: string; pozadi: string };

export type Vstup =
  | { typ: "tap" } // klik / tap / mezerník / ↑ — „akce“
  | { typ: "pohyb"; x: number } // x v logických px plátna (prst nebo tažení myší)
  | { typ: "klavesa"; smer: -1 | 0 | 1 }; // ← → držení, 0 = puštění

export type Zvuk = "skok" | "bod" | "bonus" | "zasah" | "konec";

export type Krok = { skore: number; konec: boolean; zvuky?: Zvuk[] };

export type Rozmer = { W: number; H: number };

export type Hra<S extends Rozmer> = {
  slug: HraSlug;
  nazev: string;
  popis: string;
  napoveda: { mys: string; dotyk: string };
  jednotka: string; // „m“, „bodů“…
  start(r: Rozmer): S;
  vstup(stav: S, v: Vstup): void;
  krok(stav: S, dt: number): Krok; // dt v sekundách, obal ořezává na 0,05
  vykresli(ctx: CanvasRenderingContext2D, stav: S, barvy: Barvy, cas: number, bezi: boolean): void;
};

/** Létající srdíčka v pozadí — mají je všechny hry. */
export type Srdce = { x: number; y: number; v: number };
export function novaSrdce(r: Rozmer, pocet: number): Srdce[] {
  return Array.from({ length: pocet }, (_, i) => ({
    x: (i / pocet) * r.W + Math.random() * 80,
    y: 20 + Math.random() * Math.max(40, r.H * 0.45),
    v: 0.5 + Math.random() * 0.5,
  }));
}
export function posunSrdce(s: Srdce[], r: Rozmer, dt: number) {
  for (const h of s) {
    h.x -= h.v * 12 * dt;
    if (h.x < -30) {
      h.x = r.W + 20;
      h.y = 20 + Math.random() * Math.max(40, r.H * 0.45);
    }
  }
}
