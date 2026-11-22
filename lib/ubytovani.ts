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
 * Spolu se stavem se ukládá i seznam rezervací pro /admin — ten bere
 * uložený seznam, jen když je mladší než ADMIN_MS.
 */
const CERSTVY_MS = 60 * 60 * 1000;
const ADMIN_MS = 5 * 60 * 1000;
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

/** Jedna rezervace, jak ji ukazuje /admin. */
export type Rezervace = {
  id: string;
  jmeno: string;
  pocet: number;
  status: string;
  /** Kdy přišla — z formuláře „Datum rezervace“, u ručních řádků vznik řádku. */
  kdy: string;
};

type AirtableZaznam = {
  id: string;
  createdTime: string;
  fields: {
    "Jméno hosta"?: string;
    "Počet osob"?: number;
    Status?: string;
    "Datum rezervace"?: string;
  };
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
    for (const pole of ["Jméno hosta", "Počet osob", "Status", "Datum rezervace"]) {
      url.searchParams.append("fields[]", pole);
    }
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

const zrusena = (z: AirtableZaznam) => z.fields.Status === "Zrušeno";

function spocitej(zaznamy: AirtableZaznam[]): Stav {
  const obsazeno = zaznamy
    .filter((z) => !zrusena(z))
    .reduce((soucet, z) => soucet + (z.fields["Počet osob"] ?? 0), 0);
  return {
    obsazeno,
    celkem: KAPACITA_CELKEM,
    volno: Math.max(0, KAPACITA_CELKEM - obsazeno),
  };
}

/** Rezervace pro /admin — nejnovější první. */
function prevedRezervace(zaznamy: AirtableZaznam[]): Rezervace[] {
  return zaznamy
    .map((z) => ({
      id: z.id,
      jmeno: z.fields["Jméno hosta"]?.trim() || "(bez jména)",
      pocet: z.fields["Počet osob"] ?? 0,
      status: z.fields.Status ?? "",
      kdy: z.fields["Datum rezervace"] ?? z.createdTime,
    }))
    .toSorted((a, b) => b.kdy.localeCompare(a.kdy));
}

type Ulozeny = { stav: Stav; rezervace: Rezervace[]; ulozeno: number };

/** Je uložený stav mladší než `maxStari`? Starý formát (bez seznamu) není nikdy. */
export function jeCerstvy(
  u: Ulozeny | null,
  maxStari: number = CERSTVY_MS,
  ted: number = Date.now(),
): boolean {
  return u !== null && Array.isArray(u.rezervace) && ted - u.ulozeno < maxStari;
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
async function uloz(zaznamy: AirtableZaznam[]): Promise<Ulozeny> {
  const u: Ulozeny = {
    stav: spocitej(zaznamy),
    rezervace: prevedRezervace(zaznamy),
    ulozeno: Date.now(),
  };
  if (maRedis()) {
    try {
      await redis().set<Ulozeny>(KLIC.ubytovani, u);
    } catch (error) {
      console.warn("[ubytovani] stav se nepodařilo uložit", error);
    }
  }
  return u;
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

/** Stav a seznam: z Redisu, je-li mladší než `maxStari`, jinak z Airtable,
 *  při chybě Airtable poslední známý. */
async function nacti(maxStari: number): Promise<Ulozeny> {
  const ulozeny = await nactiUlozeny();
  const zaloha = ulozeny && { ...ulozeny, rezervace: ulozeny.rezervace ?? [] };
  if (zaloha && jeCerstvy(ulozeny, maxStari)) return zaloha;
  // Airtable už čte jiný požadavek — tenhle vystačí s posledním stavem
  if (zaloha && !(await vezmiZamek())) return zaloha;

  try {
    return await uloz(await nactiZaznamy());
  } catch (error) {
    if (!zaloha) throw error;
    console.warn("[ubytovani] Airtable nejde, ukazuji poslední známý stav", error);
    // zámek prodloužit, ať se do nefunkčního Airtable nebuší každých 30 s
    if (maRedis()) {
      try {
        await redis().expire(KLIC.ubytovaniZamek, PAUZA_PO_CHYBE_S);
      } catch {
        /* bez pauzy to zkusí další požadavek — nevadí */
      }
    }
    return zaloha;
  }
}

/** Aktuální stav kapacity pro web (nejvýš hodinu starý). */
export async function stavKapacity(): Promise<Stav> {
  const { stav } = await nacti(CERSTVY_MS);
  return stav;
}

/** Rezervace pro /admin (nejvýš ADMIN_MS staré; `ulozeno` = odkdy). */
export function prehledRezervaci(): Promise<Ulozeny> {
  return nacti(ADMIN_MS);
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
    (z) => !zrusena(z) && normalizujJmeno(z.fields["Jméno hosta"] ?? "") === hledane,
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
  // nový řádek rovnou do uloženého seznamu — další čtení z Airtable netřeba
  const { records } = (await odpoved.json()) as { records: AirtableZaznam[] };
  const { stav } = await uloz([...zaznamy, ...records]);
  return { ok: true, stav };
}
