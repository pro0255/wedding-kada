import { chybaOdpoved } from "@/lib/chyby";
import { prepniLajk } from "@/lib/fotky";
import { BEZ_PRISTUPU, maPristupKFotkam } from "@/lib/fotkyPristup";
import { LajkPostSchema } from "@/lib/schemata";

/** Přepnutí lajku (srdíčka) na fotce — max jeden na zařízení a fotku. */
export async function POST(request: Request) {
  if (!(await maPristupKFotkam())) return BEZ_PRISTUPU();
  const telo = LajkPostSchema.safeParse(await request.json().catch(() => null));
  if (!telo.success) return chybaOdpoved("neplatny-pozadavek");

  try {
    return Response.json({
      ok: true,
      ...(await prepniLajk(telo.data.fotkaId, telo.data.deviceId)),
    });
  } catch (error) {
    console.error("[fotky] Lajk se nepodařilo uložit:", error);
    return chybaOdpoved("lajk-neulozen");
  }
}
