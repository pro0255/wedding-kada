import { KLIC, maRedis, redis } from "./redis.ts";

/** Celkový počet lůžek k dispozici. */
export const KAPACITA_CELKEM = 26;

/**
 * Rezervace žijí v Airtable tabulce „Rezervace“ — ta je jediným zdrojem
 * pravdy. Každý řádek má Status: „Zamluveno“ (mimo web), „Rezervováno“
 * (z formuláře) nebo „Zrušeno“ (nepočítá se do obsazenosti).
 * Airtable free má jen 1 000 volání měsíčně a sekce ubytování se ptá při
 * každém otevření webu. Proto:
 * - poslední stav leží v Redisu bez expirace a hodinu (CERSTVY_MS) se bere
 *   rovnou odtud — čtení z Airtable je tak nejvýš ~720 za měsíc,
 * - po hodině jde do Airtable jen jeden požadavek (zámek), ostatní mezitím
 *   dostanou poslední stav,
 * - když Airtable selže (třeba vyčerpaný limit), web ukáže poslední stav
 *   místo chyby a další pokus zkusí až za PAUZA_PO_CHYBE_S.
 * Ruční úpravy v tabulce se na webu projeví nejpozději do hodiny.
 * Rezervace z formuláře čte tabulku vždy čerstvě (duplicity, volná místa).
 */
const CERSTVY_MS = 60 * 60 * 1000;
const ZAMEK_S = 30;
const PAUZA_PO_CHYBE_S = 600;
export const BASE_ID = "appw1s9BtzlKCPous";
const TABULKA = "Rezervace";
const API = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABULKA)}`;

export type Stav = {
  obsazeno: number;
  celkem: number;
  volno: number;
};

type AirtableZaznam = {
  id: string;
  fields: { "Jméno hosta"?: string; "Počet osob"?: number; Status?: string };
};

/**
 * Normalizace pro porovnání jmen: bez diakritiky, malá písmena, jedno
 * mezerování a abecedně seřazená slova — takže „Nováková Jana“,
 * „JANA novakova“ i „Jana  Nováková“ jsou totéž jméno.
 */
function normalizujJmeno(jmeno: string): string {
  return jmeno
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .toSorted()
    .join(" ");
}

function hlavicky(): Record<string, string> {
  const klic = process.env.AIRTABLE_KEY;
  if (!klic) throw new Error("Chybí AIRTABLE_KEY v prostředí.");
  return {
    Authorization: `Bearer ${klic}`,
    "Content-Type": "application/json",
  };
}

async function nactiZaznamy(): Promise<AirtableZaznam[]> {
  const zaznamy: AirtableZaznam[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(API);
    url.searchParams.set("pageSize", "100");
    url.searchParams.append("fields[]", "Jméno hosta");
    url.searchParams.append("fields[]", "Počet osob");
    url.searchParams.append("fields[]", "Status");
    if (offset) url.searchParams.set("offset", offset);

    const odpoved = await fetch(url, { headers: hlavicky(), cache: "no-store" });
    if (!odpoved.ok) {
      throw new Error(`Airtable vrátil ${odpoved.status}: ${await odpoved.text()}`);
    }
    const data = (await odpoved.json()) as {
      records: AirtableZaznam[];
      offset?: string;
    };
    zaznamy.push(...data.records);
    offset = data.offset;
  } while (offset);

  return zaznamy;
}

function spocitej(zaznamy: AirtableZaznam[]): Stav {
  const obsazeno = zaznamy
    .filter((z) => z.fields.Status !== "Zrušeno")
    .reduce((soucet, z) => soucet + (z.fields["Počet osob"] ?? 0), 0);
  return {
    obsazeno,
    celkem: KAPACITA_CELKEM,
    volno: Math.max(0, KAPACITA_CELKEM - obsazeno),
  };
}

type Ulozeny = { stav: Stav; ulozeno: number };

/** Je uložený stav dost čerstvý, aby se Airtable nemusel ptát? */
export function jeCerstvy(u: Ulozeny | null, ted: number = Date.now()): boolean {
  return u !== null && ted - u.ulozeno < CERSTVY_MS;
}

/* Redis je tu jen paměť nad Airtable, ne zdroj pravdy. Když chybí
   v prostředí nebo selže, kapacita se spočítá rovnou z Airtable — dřív se
   o něj API opřelo hned prvním příkazem, vrátilo 502 a v rozhraní stálo
   „volných míst: undefined“. */
async function nactiUlozeny(): Promise<Ulozeny | null> {
  if (!maRedis()) return null;
  try {
    return await redis().get<Ulozeny>(KLIC.ubytovani);
  } catch (error) {
    console.warn("[ubytovani] uložený stav nedostupný, čtu rovnou z Airtable", error);
    return null;
  }
}

/** Uloží stav (bez expirace — slouží i jako záloha, když Airtable nejde). */
async function ulozStav(stav: Stav): Promise<void> {
  if (!maRedis()) return;
  try {
    await redis().set<Ulozeny>(KLIC.ubytovani, { stav, ulozeno: Date.now() });
  } catch (error) {
    console.warn("[ubytovani] stav se nepodařilo uložit", error);
  }
}

/** Smí tenhle požadavek jít do Airtable? Jen jeden naráz; bez Redisu vždy. */
async function vezmiZamek(): Promise<boolean> {
  if (!maRedis()) return true;
  try {
    return (await redis().set(KLIC.ubytovaniZamek, 1, { nx: true, ex: ZAMEK_S })) === "OK";
  } catch {
    return true;
  }
}

/** Aktuální stav kapacity (z Redisu, po hodině z Airtable, při chybě poslední známý). */
export async function stavKapacity(): Promise<Stav> {
  const ulozeny = await nactiUlozeny();
  if (ulozeny && jeCerstvy(ulozeny)) return ulozeny.stav;
  // Airtable už čte jiný požadavek — tenhle vystačí s posledním stavem
  if (ulozeny && !(await vezmiZamek())) return ulozeny.stav;

  try {
    const stav = spocitej(await nactiZaznamy());
    await ulozStav(stav);
    return stav;
  } catch (error) {
    if (!ulozeny) throw error;
    console.warn("[ubytovani] Airtable nejde, ukazuji poslední známý stav", error);
    // zámek prodloužit, ať se do nefunkčního Airtable nebuší každých 30 s
    if (maRedis()) {
      try {
        await redis().expire(KLIC.ubytovaniZamek, PAUZA_PO_CHYBE_S);
      } catch {
        /* bez pauzy to zkusí další požadavek — nevadí */
      }
    }
    return ulozeny.stav;
  }
}

export type VysledekRezervace =
  | { ok: true; stav: Stav }
  | { ok: false; duvod: "plno" | "duplicita"; stav: Stav };

/** Zapíše rezervaci do Airtable a vrátí přepočítaný stav. */
export async function pridejRezervaci(jmeno: string, pocet: number): Promise<VysledekRezervace> {
  const zaznamy = await nactiZaznamy();
  const pred = spocitej(zaznamy);

  const hledane = normalizujJmeno(jmeno);
  const uzRezervoval = zaznamy.some(
    (z) =>
      z.fields.Status !== "Zrušeno" && normalizujJmeno(z.fields["Jméno hosta"] ?? "") === hledane,
  );
  if (uzRezervoval) {
    return { ok: false, duvod: "duplicita", stav: pred };
  }

  if (pocet > pred.volno) {
    return { ok: false, duvod: "plno", stav: pred };
  }

  const odpoved = await fetch(API, {
    method: "POST",
    headers: hlavicky(),
    body: JSON.stringify({
      // typecast doplní volbu „Rezervováno“, kdyby v tabulce ještě chyběla
      typecast: true,
      records: [
        {
          fields: {
            "Jméno hosta": jmeno,
            "Počet osob": pocet,
            Status: "Rezervováno",
            "Datum rezervace": new Date().toISOString(),
          },
        },
      ],
    }),
  });
  if (!odpoved.ok) {
    throw new Error(`Airtable vrátil ${odpoved.status}: ${await odpoved.text()}`);
  }

  const stav = {
    ...pred,
    obsazeno: pred.obsazeno + pocet,
    volno: Math.max(0, pred.volno - pocet),
  };
  await ulozStav(stav);
  return { ok: true, stav };
}
