import { chybaOdpoved } from "@/lib/chyby";
import { lidri } from "@/lib/hra";

/** Lídr každé hry pro karty ve výběru her. */
export async function GET() {
  try {
    return Response.json(await lidri());
  } catch (error) {
    console.error("[hra] Lídry se nepodařilo načíst:", error);
    return chybaOdpoved("lidri-nenacteni");
  }
}
