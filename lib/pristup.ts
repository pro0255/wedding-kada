import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Vstup do galerie fotek: host musí znát odpověď na otázku, kterou cizí
 * neznají. Odpověď je jen v proměnné prostředí FOTKY_HESLO (repozitář je
 * veřejný, do kódu nesmí). Po správné odpovědi dostane prohlížeč httpOnly
 * cookie s tokenem odvozeným z hesla — změna hesla tak zneplatní všechny
 * dosavadní vstupy.
 *
 * Čisté funkce bez Next.js, ať jdou otestovat přes node --test.
 */

export const COOKIE_FOTKY = "fotky_pristup";
// rok — host se po svatbě vrací pro fotky a nemá hádat znovu
export const COOKIE_FOTKY_MAX_AGE = 60 * 60 * 24 * 365;

/** Bez ohledu na velikost písmen, diakritiku a mezery okolo: „ Bára “ = „bara“. */
export function normalizuj(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

function stejne(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function jeSpravnaOdpoved(odpoved: string, heslo: string): boolean {
  const h = normalizuj(heslo);
  return h.length > 0 && stejne(normalizuj(odpoved), h);
}

/** Token do cookie — HMAC pevného textu klíčem z hesla. */
export function tokenPristupu(heslo: string): string {
  return createHmac("sha256", normalizuj(heslo)).update("fotky-v1").digest("base64url");
}

export function platnyToken(token: string | undefined, heslo: string): boolean {
  if (!token || !normalizuj(heslo)) return false;
  return stejne(token, tokenPristupu(heslo));
}
