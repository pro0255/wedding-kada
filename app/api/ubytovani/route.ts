import { pridejRezervaci, stavKapacity } from "@/lib/ubytovani";
import { RezervacePostSchema } from "@/lib/schemata";

/* Upozornění na novou rezervaci posílá automatizace v Airtable, ne web. */

/** Aktuální stav kapacity pro zobrazení na webu. */
export async function GET() {
  try {
    return Response.json(await stavKapacity());
  } catch (chyba) {
    console.error("[ubytovani] Nepodařilo se načíst kapacitu:", chyba);
    return Response.json({ chyba: "Kapacitu se nepodařilo načíst." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const telo = RezervacePostSchema.safeParse(await request.json().catch(() => null));
  if (!telo.success) {
    return Response.json({ chyba: telo.error.issues[0].message }, { status: 400 });
  }
  const { jmeno, pocet } = telo.data;

  let vysledek;
  try {
    vysledek = await pridejRezervaci(jmeno, pocet);
  } catch (chyba) {
    console.error("[ubytovani] Rezervaci se nepodařilo uložit:", chyba);
    return Response.json(
      { chyba: "Rezervaci se nepodařilo uložit, zkuste to prosím za chvíli." },
      { status: 502 }
    );
  }

  if (!vysledek.ok) {
    const chyba =
      vysledek.duvod === "duplicita"
        ? "Vypadá to, že rezervaci na toto jméno už máme. Pokud potřebujete něco změnit nebo přidat, ozvěte se nám."
        : vysledek.stav.volno === 0
          ? "Kapacita ubytování je bohužel už plná."
          : `Zbývá už jen ${vysledek.stav.volno} volných míst.`;
    return Response.json({ chyba, stav: vysledek.stav }, { status: 409 });
  }

  return Response.json({ ok: true, stav: vysledek.stav });
}
