/**
 * Pravidla fronty nahrávání fotek (app/nahravani.ts). Čisté funkce bez
 * prohlížeče, ať jdou otestovat.
 *
 * Svatba je na místě se slabým signálem: nahrání může spadnout, zaseknout
 * se nebo trvat minuty. Fronta proto drží soubory v telefonu (IndexedDB),
 * zkouší to znovu s rostoucí pauzou a pokračuje i po zavření stránky.
 */

/** Když se upload tak dlouho nepohne, je zaseknutý — přeruší se a zkusí znovu. */
export const ZASEKNUTI_MS = 30_000;
/** Po odeslání posledního bajtu Cloudinary ještě zpracovává (u videa i desítky sekund). */
export const CEKANI_NA_ODPOVED_MS = 90_000;
/** Registrace fotky u nás je malý JSON — déle než tohle čekat nemá smysl. */
export const REGISTRACE_MS = 20_000;
/** Po kolika neúspěšných pokusech nabídnout WhatsApp skupinu (fronta jede dál). */
export const ZALOHA_PO_POKUSECH = 3;

const PAUZY_S = [2, 5, 15, 30, 60];

/** Za kolik ms zkusit soubor znovu po `pokusy` neúspěších (2 s, 5 s, 15 s, 30 s, pak po minutě). */
export function pauzaPredPokusem(pokusy: number): number {
  return PAUZY_S[Math.min(Math.max(pokusy, 1), PAUZY_S.length) - 1] * 1000;
}

/**
 * Co s chybou podle HTTP stavu. 0 = síť (výpadek, zaseknutí, přerušení).
 * Síť, přetížení a chyby serveru se zkouší znovu; 401 znamená, že vstup do
 * galerie vypršel; ostatní 4xx (soubor odmítnutý Cloudinary) se opakovat
 * nevyplatí — stejný soubor projde stejně špatně.
 */
export function posudChybu(status: number): "znovu" | "zamceno" | "vzdat" {
  if (status === 401) return "zamceno";
  if (status === 0 || status === 408 || status === 429 || status >= 500) return "znovu";
  return "vzdat";
}

export type CekajiciPolozka = { id: string; pridano: number; dalsiPokus: number };

/** Kterou položku nahrávat teď: nejstarší z těch, na které už došla řada. */
export function vyberDalsi<T extends CekajiciPolozka>(polozky: T[], ted: number): T | null {
  const pripravene = polozky.filter((p) => p.dalsiPokus <= ted);
  let nejstarsi: T | null = null;
  for (const p of pripravene) if (!nejstarsi || p.pridano < nejstarsi.pridano) nejstarsi = p;
  return nejstarsi;
}

/** Za jak dlouho má smysl se znovu podívat, když teď na nic nedošla řada. */
export function cekatDo<T extends CekajiciPolozka>(polozky: T[], ted: number): number {
  if (polozky.length === 0) return 0;
  return Math.max(0, Math.min(...polozky.map((p) => p.dalsiPokus)) - ted);
}
