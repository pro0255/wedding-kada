import { jmenoHosta, ulozJmeno } from "@/lib/host";
import { DeviceIdSchema, HostPostSchema } from "@/lib/schemata";
import { chybaOdpoved } from "@/lib/chyby";

/** Jméno hosta pro dané zařízení (null = nevyplněno). */
export async function GET(request: Request) {
  const device = DeviceIdSchema.safeParse(new URL(request.url).searchParams.get("device"));
  if (!device.success) return chybaOdpoved("neplatny-pozadavek");
  try {
    return Response.json({ jmeno: await jmenoHosta(device.data) });
  } catch (chyba) {
    console.error("[host] Jméno se nepodařilo načíst:", chyba);
    return chybaOdpoved("jmeno-nenacteno");
  }
}

/** Uložení / změna jména — jeden řádek na zařízení. */
export async function POST(request: Request) {
  const telo = HostPostSchema.safeParse(await request.json().catch(() => null));
  if (!telo.success) {
    return chybaOdpoved("jmeno-neplatne");
  }
  try {
    await ulozJmeno(telo.data.deviceId, telo.data.jmeno);
    return Response.json({ ok: true, jmeno: telo.data.jmeno });
  } catch (chyba) {
    console.error("[host] Jméno se nepodařilo uložit:", chyba);
    return chybaOdpoved("jmeno-neulozeno");
  }
}
