import { KLIC, maRedis, redis } from "./redis.ts";

/** Celkový počet lůžek k dispozici. */
export const KAPACITA_CELKEM = 26;

/**
 * Rezervace žijí v Airtable tabulce „Rezervace“ — ta je jediným zdrojem
 * pravdy. Každý řádek má Status: „Zamluveno“ (mimo web), „Rezervováno“
 * (z formuláře) nebo „Zrušeno“ (nepočítá se do obsazenosti).
 * Stav se drží v Redisu CACHE_S sekund — Airtable free má jen 1 000 volání
 * měsíčně a sekce ubytování se ptá při každém otevření webu. Ruční úpravy
 * v tabulce se proto na webu projeví nejpozději do 10 minut.
 */
const CACHE_S = 600;
const BASE_ID = "appw1s9BtzlKCPous";
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
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
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

/** Aktuální stav kapacity (z cache, jinak z Airtable). */
/** Uloží stav do cache, pokud je k dispozici. Selhání cache nesmí shodit
 *  odpověď — data jsou v Airtable, tohle je jen zrychlení. */
async function ulozDoCache(stav: Stav): Promise<void> {
  if (!maRedis()) return;
  try {
    await redis().set(KLIC.ubytovani, stav, { ex: CACHE_S });
  } catch (chyba) {
    console.warn("[ubytovani] stav se nepodařilo uložit do cache", chyba);
  }
}

export async function stavKapacity(): Promise<Stav> {
  /* Redis je tu jen cache nad Airtable, ne zdroj pravdy. Když chybí
     v prostředí nebo selže, kapacita se spočítá rovnou z Airtable — dřív se
     o něj API opřelo hned prvním příkazem, vrátilo 502 a v rozhraní stálo
     „volných míst: undefined“. */
  if (maRedis()) {
    try {
      const ulozeny = await redis().get<Stav>(KLIC.ubytovani);
      if (ulozeny) return ulozeny;
    } catch (chyba) {
      console.warn("[ubytovani] cache nedostupná, čtu rovnou z Airtable", chyba);
    }
  }
  const stav = spocitej(await nactiZaznamy());
  await ulozDoCache(stav);
  return stav;
}

export type VysledekRezervace =
  | { ok: true; stav: Stav }
  | { ok: false; duvod: "plno" | "duplicita"; stav: Stav };

/** Zapíše rezervaci do Airtable a vrátí přepočítaný stav. */
export async function pridejRezervaci(
  jmeno: string,
  pocet: number
): Promise<VysledekRezervace> {
  const zaznamy = await nactiZaznamy();
  const pred = spocitej(zaznamy);

  const hledane = normalizujJmeno(jmeno);
  const uzRezervoval = zaznamy.some(
    (z) =>
      z.fields.Status !== "Zrušeno" &&
      normalizujJmeno(z.fields["Jméno hosta"] ?? "") === hledane
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
  await ulozDoCache(stav);
  return { ok: true, stav };
}
