import { chybaOdpoved } from "@/lib/chyby";
import { BEZ_PRISTUPU, jeSpravce } from "@/lib/fotkyPristup";
import { hesloSpravce, jeSpravnaOdpoved } from "@/lib/pristup";
import { UklidPostSchema } from "@/lib/schemata";
import { uklid } from "@/lib/uklid";

/** Úklid testovacích dat (lib/uklid.ts). Jen správce, a ještě jednou
 *  heslem — mazání nejde vrátit a správcovská cookie vydrží rok. */
export async function POST(request: Request) {
  if (!(await jeSpravce())) return BEZ_PRISTUPU();
  const telo = UklidPostSchema.safeParse(await request.json().catch(() => null));
  if (!telo.success) return chybaOdpoved("neplatny-pozadavek");
  if (!jeSpravnaOdpoved(telo.data.heslo, hesloSpravce())) return chybaOdpoved("spatna-odpoved");

  try {
    return Response.json({ ok: true, smazano: await uklid() });
  } catch (error) {
    console.error("[admin] Úklid se nedokončil:", error);
    return chybaOdpoved("uklid-nedokoncen");
  }
}
