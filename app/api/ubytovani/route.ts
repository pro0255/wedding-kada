import { pridejRezervaci, stavKapacity } from "@/lib/ubytovani";
import { RezervacePostSchema } from "@/lib/schemata";
import { chybaOdpoved } from "@/lib/chyby";

/* Upozornění na novou rezervaci posílá automatizace v Airtable, ne web. */

/** Aktuální stav kapacity pro zobrazení na webu. */
export async function GET() {
  try {
    return Response.json(await stavKapacity());
  } catch (chyba) {
    console.error("[ubytovani] Nepodařilo se načíst kapacitu:", chyba);
    return chybaOdpoved("kapacita-nenactena");
  }
}

export async function POST(request: Request) {
  const telo = RezervacePostSchema.safeParse(await request.json().catch(() => null));
  if (!telo.success) {
    return chybaOdpoved("rezervace-neplatna", { hlaska: telo.error.issues[0].message });
  }
  const { jmeno, pocet } = telo.data;

  let vysledek;
  try {
    vysledek = await pridejRezervaci(jmeno, pocet);
  } catch (chyba) {
    console.error("[ubytovani] Rezervaci se nepodařilo uložit:", chyba);
    return chybaOdpoved("rezervace-neulozena");
  }

  if (!vysledek.ok) {
    const { stav } = vysledek;
    if (vysledek.duvod === "duplicita") return chybaOdpoved("rezervace-duplicita", { stav });
    if (stav.volno === 0) return chybaOdpoved("rezervace-plno", { stav });
    return chybaOdpoved("rezervace-malo-mist", {
      stav,
      hlaska: `Zbývá už jen ${stav.volno} volných míst.`,
    });
  }

  return Response.json({ ok: true, stav: vysledek.stav });
}
