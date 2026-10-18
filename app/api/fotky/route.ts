import { pridejFotku, seznamFotek, smazFotku } from "@/lib/fotky";
import { DeviceIdSchema, FotkaDeleteSchema, FotkaPostSchema } from "@/lib/schemata";

/** Galerie pro dané zařízení. */
export async function GET(request: Request) {
  const device = DeviceIdSchema.safeParse(new URL(request.url).searchParams.get("device"));
  try {
    return Response.json({ fotky: await seznamFotek(device.success ? device.data : "") });
  } catch (chyba) {
    console.error("[fotky] Galerii se nepodařilo načíst:", chyba);
    return Response.json({ chyba: "Galerii se nepodařilo načíst." }, { status: 502 });
  }
}

/** Registrace fotky nahrané z mobilu přímo do Cloudinary. */
export async function POST(request: Request) {
  const telo = FotkaPostSchema.safeParse(await request.json().catch(() => null));
  if (!telo.success) return Response.json({ chyba: "Neplatný požadavek." }, { status: 400 });

  try {
    const id = await pridejFotku(telo.data.url, telo.data.publicId, telo.data.deviceId);
    return Response.json({ ok: true, id });
  } catch (chyba) {
    console.error("[fotky] Fotku se nepodařilo uložit:", chyba);
    return Response.json({ chyba: "Fotku se nepodařilo uložit." }, { status: 502 });
  }
}

/** Smazání vlastní fotky. */
export async function DELETE(request: Request) {
  const telo = FotkaDeleteSchema.safeParse(await request.json().catch(() => null));
  if (!telo.success) return Response.json({ chyba: "Neplatný požadavek." }, { status: 400 });

  try {
    const vysledek = await smazFotku(telo.data.id, telo.data.deviceId);
    if (!vysledek.ok) {
      return Response.json(
        { chyba: "Tuhle fotku smazat nemůžete." },
        { status: vysledek.duvod === "neexistuje" ? 404 : 403 }
      );
    }
    return Response.json({ ok: true });
  } catch (chyba) {
    console.error("[fotky] Fotku se nepodařilo smazat:", chyba);
    return Response.json({ chyba: "Fotku se nepodařilo smazat." }, { status: 502 });
  }
}
