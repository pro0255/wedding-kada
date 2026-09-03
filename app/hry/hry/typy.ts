import type { HraSlug } from "@/lib/hra";

/* Hra je čistý modul bez Reactu: stav, vstup, krok, vykreslení. Obal
   `Hra.tsx` řídí smyčku, plátno, vstupy, zvuk a ukládání skóre. */

export type Barvy = { ink: string; inkJemny: string; zlata: string; pozadi: string };

export type Vstup =
  | { typ: "tap" } // klik / tap / mezerník / ↑ — „akce“
  | { typ: "pohyb"; x: number } // x v logických px plátna (prst nebo tažení myší)
  | { typ: "klavesa"; smer: -1 | 0 | 1 }; // ← → držení, 0 = puštění

export type Zvuk = "skok" | "bod" | "bonus" | "zasah" | "konec";

export type Krok = { skore: number; konec: boolean; zvuky?: Zvuk[] };

export type Hra<S> = {
  slug: HraSlug;
  nazev: string;
  popis: string;
  napoveda: { mys: string; dotyk: string };
  jednotka: string; // „m“, „bodů“…
  W: number;
  H: number;
  start(): S;
  vstup(stav: S, v: Vstup): void;
  krok(stav: S, dt: number): Krok; // dt v sekundách, obal ořezává na 0,05
  vykresli(ctx: CanvasRenderingContext2D, stav: S, barvy: Barvy, cas: number, bezi: boolean): void;
};
