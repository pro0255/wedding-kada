/**
 * Jediné místo, kde web mluví s Airtable REST API. Base je společná pro
 * rezervace, fotky i hry — token má práva jen na ni.
 */
export const BASE_ID = "appw1s9BtzlKCPous";

export type Zaznam<F = Record<string, unknown>> = { id: string; fields: F };

export function apiTabulky(nazev: string): string {
  return `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(nazev)}`;
}

export function hlavicky(): Record<string, string> {
  const klic = process.env.AIRTABLE_KEY;
  if (!klic) throw new Error("Chybí AIRTABLE_KEY v prostředí.");
  return { Authorization: `Bearer ${klic}`, "Content-Type": "application/json" };
}

/** Do formule jdou jen naše vygenerované hodnoty (uuid, rec id), ale pro jistotu. */
export function doFormule(hodnota: string): string {
  return hodnota.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function over(odpoved: Response): Promise<Response> {
  if (!odpoved.ok) {
    throw new Error(`Airtable vrátil ${odpoved.status}: ${await odpoved.text()}`);
  }
  return odpoved;
}

export async function nactiZaznamy<F = Record<string, unknown>>(
  api: string,
  filtr?: string,
): Promise<Zaznam<F>[]> {
  const zaznamy: Zaznam<F>[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(api);
    url.searchParams.set("pageSize", "100");
    if (filtr) url.searchParams.set("filterByFormula", filtr);
    if (offset) url.searchParams.set("offset", offset);
    const odpoved = await over(await fetch(url, { headers: hlavicky(), cache: "no-store" }));
    const data = (await odpoved.json()) as { records: Zaznam<F>[]; offset?: string };
    zaznamy.push(...data.records);
    offset = data.offset;
  } while (offset);
  return zaznamy;
}

export async function vlozZaznam<F>(api: string, fields: F): Promise<string> {
  const odpoved = await over(
    await fetch(api, {
      method: "POST",
      headers: hlavicky(),
      body: JSON.stringify({ records: [{ fields }] }),
    }),
  );
  const data = (await odpoved.json()) as { records: { id: string }[] };
  return data.records[0].id;
}

export async function upravZaznam<F>(api: string, id: string, fields: Partial<F>): Promise<void> {
  await over(
    await fetch(`${api}/${id}`, {
      method: "PATCH",
      headers: hlavicky(),
      body: JSON.stringify({ fields }),
    }),
  );
}

export async function smazZaznamy(api: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const url = new URL(api);
  for (const id of ids) url.searchParams.append("records[]", id);
  await over(await fetch(url, { method: "DELETE", headers: hlavicky() }));
}
