import { lidri } from "@/lib/hra";

/** Lídr každé hry pro karty ve výběru her. */
export async function GET() {
  try {
    return Response.json(await lidri());
  } catch (chyba) {
    console.error("[hra] Lídry se nepodařilo načíst:", chyba);
    return Response.json({ chyba: "Lídry se nepodařilo načíst." }, { status: 502 });
  }
}
