import { chybaOdpoved } from "@/lib/chyby";
import { jmenoHosta, ulozJmeno } from "@/lib/host";
import { DeviceIdSchema, HostPostSchema } from "@/lib/schemata";

/** Jméno hosta pro dané zařízení (null = nevyplněno). */
export async function GET(request: Request) {
  const device = DeviceIdSchema.safeParse(new URL(request.url).searchParams.get("device"));
  if (!device.success) return chybaOdpoved("neplatny-pozadavek");
  try {
    return Response.json({ jmeno: await jmenoHosta(device.data) });
  } catch (error) {
    console.error("[host] Jméno se nepodařilo načíst:", error);
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
  } catch (error) {
    console.error("[host] Jméno se nepodařilo uložit:", error);
    return chybaOdpoved("jmeno-neulozeno");
  }
}
