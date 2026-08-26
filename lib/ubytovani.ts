import { promises as fs } from "node:fs";
import path from "node:path";

/** Celkový počet lůžek k dispozici. */
export const KAPACITA_CELKEM = 26;
/** Místa obsazená mimo formulář (domluvená předem) — výchozí stav 7/26. */
export const KAPACITA_ZAKLAD = 7;

export type Rezervace = {
  jmeno: string;
  pocet: number;
  /** ISO datum odeslání */
  kdy: string;
};

export type Stav = {
  obsazeno: number;
  celkem: number;
  volno: number;
};

type Data = { rezervace: Rezervace[] };

const SOUBOR = path.join(process.cwd(), "data", "ubytovani.json");

async function nacti(): Promise<Data> {
  try {
    const raw = await fs.readFile(SOUBOR, "utf8");
    const data = JSON.parse(raw) as Partial<Data>;
    return { rezervace: Array.isArray(data.rezervace) ? data.rezervace : [] };
  } catch {
    // soubor ještě neexistuje (nebo je poškozený) — začínáme s prázdným seznamem
    return { rezervace: [] };
  }
}

async function uloz(data: Data): Promise<void> {
  await fs.mkdir(path.dirname(SOUBOR), { recursive: true });
  await fs.writeFile(SOUBOR, JSON.stringify(data, null, 2), "utf8");
}

function spocitej(data: Data): Stav {
  const obsazeno =
    KAPACITA_ZAKLAD + data.rezervace.reduce((soucet, r) => soucet + r.pocet, 0);
  return {
    obsazeno,
    celkem: KAPACITA_CELKEM,
    volno: Math.max(0, KAPACITA_CELKEM - obsazeno),
  };
}

// zápisy řadíme za sebe, aby si dva souběžné požadavky nepřepsaly soubor
let fronta: Promise<unknown> = Promise.resolve();
function serializuj<T>(operace: () => Promise<T>): Promise<T> {
  const vysledek = fronta.then(operace, operace);
  fronta = vysledek.catch(() => {});
  return vysledek;
}

/** Aktuální stav kapacity. */
export async function stavKapacity(): Promise<Stav> {
  return spocitej(await nacti());
}

export type VysledekRezervace =
  | { ok: true; stav: Stav }
  | { ok: false; duvod: "plno"; stav: Stav };

/** Zapíše rezervaci a vrátí přepočítaný stav. */
export async function pridejRezervaci(
  jmeno: string,
  pocet: number
): Promise<VysledekRezervace> {
  return serializuj(async () => {
    const data = await nacti();
    const pred = spocitej(data);

    if (pocet > pred.volno) {
      return { ok: false as const, duvod: "plno" as const, stav: pred };
    }

    data.rezervace.push({ jmeno, pocet, kdy: new Date().toISOString() });
    await uloz(data);

    return { ok: true as const, stav: spocitej(data) };
  });
}
