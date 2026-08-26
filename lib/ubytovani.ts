/** Celkový počet lůžek k dispozici. */
export const KAPACITA_CELKEM = 26;

/**
 * Rezervace žijí v Airtable tabulce „Rezervace“ — ta je jediným zdrojem
 * pravdy. Každý řádek má Status: „Zamluveno“ (mimo web), „Rezervováno“
 * (z formuláře) nebo „Zrušeno“ (nepočítá se do obsazenosti).
 * Ruční úpravy v tabulce se na webu projeví okamžitě.
 */
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

/** Aktuální stav kapacity. */
export async function stavKapacity(): Promise<Stav> {
  return spocitej(await nactiZaznamy());
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

  return {
    ok: true,
    stav: {
      ...pred,
      obsazeno: pred.obsazeno + pocet,
      volno: Math.max(0, pred.volno - pocet),
    },
  };
}
