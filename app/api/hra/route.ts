import { chybaOdpoved } from "@/lib/chyby";
import { ulozSkore, zebricek } from "@/lib/hra";
import { SkorePostSchema, ZebricekDotazSchema } from "@/lib/schemata";

/** Žebříček jedné hry; `device` jen kvůli zvýraznění mého řádku. */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const dotaz = ZebricekDotazSchema.safeParse({
    hra: p.get("hra"),
    device: p.get("device") ?? undefined,
  });
  if (!dotaz.success) return chybaOdpoved("neznama-hra");
  try {
    return Response.json(await zebricek(dotaz.data.hra, dotaz.data.device ?? ""));
  } catch (error) {
    console.error("[hra] Žebříček se nepodařilo načíst:", error);
    return chybaOdpoved("zebricek-nenacten");
  }
}

/** Uložení jednoho dohrání. */
export async function POST(request: Request) {
  const telo = SkorePostSchema.safeParse(await request.json().catch(() => null));
  if (!telo.success) return chybaOdpoved("neplatny-pozadavek");
  const { hra, deviceId, skore } = telo.data;
  try {
    await ulozSkore(hra, deviceId, skore);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[hra] Skóre se nepodařilo uložit:", error);
    return chybaOdpoved("skore-neulozeno");
  }
}
