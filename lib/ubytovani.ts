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
  fields: { "Počet osob"?: number; Status?: string };
};

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
  | { ok: false; duvod: "plno"; stav: Stav };

/** Zapíše rezervaci do Airtable a vrátí přepočítaný stav. */
export async function pridejRezervaci(
  jmeno: string,
  pocet: number
): Promise<VysledekRezervace> {
  const pred = spocitej(await nactiZaznamy());
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
