import { jmenoHosta, ulozJmeno } from "@/lib/host";
import { DeviceIdSchema, HostPostSchema } from "@/lib/schemata";

/** Jméno hosta pro dané zařízení (null = nevyplněno). */
export async function GET(request: Request) {
  const device = DeviceIdSchema.safeParse(new URL(request.url).searchParams.get("device"));
  if (!device.success) return Response.json({ chyba: "Neplatný požadavek." }, { status: 400 });
  try {
    return Response.json({ jmeno: await jmenoHosta(device.data) });
  } catch (chyba) {
    console.error("[host] Jméno se nepodařilo načíst:", chyba);
    return Response.json({ chyba: "Jméno se nepodařilo načíst." }, { status: 502 });
  }
}

/** Uložení / změna jména — jeden řádek na zařízení. */
export async function POST(request: Request) {
  const telo = HostPostSchema.safeParse(await request.json().catch(() => null));
  if (!telo.success) {
    return Response.json({ chyba: "Jméno musí mít 1–30 znaků." }, { status: 400 });
  }
  try {
    await ulozJmeno(telo.data.deviceId, telo.data.jmeno);
    return Response.json({ ok: true, jmeno: telo.data.jmeno });
  } catch (chyba) {
    console.error("[host] Jméno se nepodařilo uložit:", chyba);
    return Response.json({ chyba: "Jméno se nepodařilo uložit." }, { status: 502 });
  }
}
