import { prepniLajk } from "@/lib/fotky";

/** Přepnutí lajku (srdíčka) na fotce — max jeden na zařízení a fotku. */
export async function POST(request: Request) {
  let telo: unknown;
  try {
    telo = await request.json();
  } catch {
    return Response.json({ chyba: "Neplatný požadavek." }, { status: 400 });
  }

  const { fotkaId, deviceId } = (telo ?? {}) as { fotkaId?: unknown; deviceId?: unknown };
  const fotkaOk = typeof fotkaId === "string" && /^rec[A-Za-z0-9]{14}$/.test(fotkaId);
  const deviceOk = typeof deviceId === "string" && /^[a-f0-9-]{16,64}$/i.test(deviceId);
  if (!fotkaOk || !deviceOk) {
    return Response.json({ chyba: "Neplatný požadavek." }, { status: 400 });
  }

  try {
    return Response.json({ ok: true, ...(await prepniLajk(fotkaId, deviceId)) });
  } catch (chyba) {
    console.error("[fotky] Lajk se nepodařilo uložit:", chyba);
    return Response.json({ chyba: "Lajk se nepodařilo uložit." }, { status: 502 });
  }
}
