import { odkazWhatsapp, pridejFotku, seznamFotek, smazFotku } from "@/lib/fotky";
import { BEZ_PRISTUPU, jeSpravce, maPristupKFotkam } from "@/lib/fotkyPristup";
import { DeviceIdSchema, FotkaDeleteSchema, FotkaPostSchema } from "@/lib/schemata";
import { chybaOdpoved } from "@/lib/chyby";

/** Galerie pro dané zařízení. Všechny metody jen pro toho, kdo prošel vstupem (/api/fotky/vstup).
 *  Přibaluje i odkaz na WhatsApp skupinu (záloha k nahrávání) — ať ho vidí jen hosté. */
export async function GET(request: Request) {
  if (!(await maPristupKFotkam())) return BEZ_PRISTUPU();
  const device = DeviceIdSchema.safeParse(new URL(request.url).searchParams.get("device"));
  try {
    return Response.json({
      fotky: await seznamFotek(device.success ? device.data : ""),
      whatsapp: odkazWhatsapp(),
    });
  } catch (chyba) {
    console.error("[fotky] Galerii se nepodařilo načíst:", chyba);
    return chybaOdpoved("galerie-nenactena");
  }
}

/** Registrace fotky nahrané z mobilu přímo do Cloudinary. */
export async function POST(request: Request) {
  if (!(await maPristupKFotkam())) return BEZ_PRISTUPU();
  const telo = FotkaPostSchema.safeParse(await request.json().catch(() => null));
  if (!telo.success) return chybaOdpoved("neplatny-pozadavek");

  try {
    const id = await pridejFotku(telo.data.url, telo.data.publicId, telo.data.deviceId);
    return Response.json({ ok: true, id });
  } catch (chyba) {
    console.error("[fotky] Fotku se nepodařilo uložit:", chyba);
    return chybaOdpoved("fotka-neulozena");
  }
}

/** Smazání vlastní fotky. */
export async function DELETE(request: Request) {
  if (!(await maPristupKFotkam())) return BEZ_PRISTUPU();
  const telo = FotkaDeleteSchema.safeParse(await request.json().catch(() => null));
  if (!telo.success) return chybaOdpoved("neplatny-pozadavek");

  try {
    const vysledek = await smazFotku(telo.data.id, telo.data.deviceId, await jeSpravce());
    if (!vysledek.ok) {
      return chybaOdpoved(vysledek.duvod === "neexistuje" ? "fotka-neexistuje" : "fotka-cizi");
    }
    return Response.json({ ok: true });
  } catch (chyba) {
    console.error("[fotky] Fotku se nepodařilo smazat:", chyba);
    return chybaOdpoved("fotka-nesmazana");
  }
}
