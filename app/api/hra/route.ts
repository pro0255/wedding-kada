import { ulozSkore, zebricek } from "@/lib/hra";
import { SkorePostSchema, ZebricekDotazSchema } from "@/lib/schemata";

/** Žebříček jedné hry; `device` jen kvůli zvýraznění mého řádku. */
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const dotaz = ZebricekDotazSchema.safeParse({
    hra: p.get("hra"),
    device: p.get("device") ?? undefined,
  });
  if (!dotaz.success) return Response.json({ chyba: "Neznámá hra." }, { status: 400 });
  try {
    return Response.json(await zebricek(dotaz.data.hra, dotaz.data.device ?? ""));
  } catch (chyba) {
    console.error("[hra] Žebříček se nepodařilo načíst:", chyba);
    return Response.json({ chyba: "Žebříček se nepodařilo načíst." }, { status: 502 });
  }
}

/** Uložení jednoho dohrání. */
export async function POST(request: Request) {
  const telo = SkorePostSchema.safeParse(await request.json().catch(() => null));
  if (!telo.success) return Response.json({ chyba: "Neplatný požadavek." }, { status: 400 });
  const { hra, deviceId, skore } = telo.data;
  try {
    await ulozSkore(hra, deviceId, skore);
    return Response.json({ ok: true });
  } catch (chyba) {
    console.error("[hra] Skóre se nepodařilo uložit:", chyba);
    return Response.json({ chyba: "Skóre se nepodařilo uložit." }, { status: 502 });
  }
}
