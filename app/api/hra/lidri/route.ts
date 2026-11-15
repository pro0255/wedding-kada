import { lidri } from "@/lib/hra";
import { chybaOdpoved } from "@/lib/chyby";

/** Lídr každé hry pro karty ve výběru her. */
export async function GET() {
  try {
    return Response.json(await lidri());
  } catch (chyba) {
    console.error("[hra] Lídry se nepodařilo načíst:", chyba);
    return chybaOdpoved("lidri-nenacteni");
  }
}
