import { pridejFotku, seznamFotek, smazFotku } from "@/lib/fotky";

/** deviceId je náš vygenerovaný uuid — nic jiného nepouštíme dál. */
function overDeviceId(hodnota: unknown): string | null {
  return typeof hodnota === "string" && /^[a-f0-9-]{16,64}$/i.test(hodnota)
    ? hodnota
    : null;
}

/** Galerie pro dané zařízení. */
export async function GET(request: Request) {
  const deviceId = overDeviceId(new URL(request.url).searchParams.get("device")) ?? "";
  try {
    return Response.json({ fotky: await seznamFotek(deviceId) });
  } catch (chyba) {
    console.error("[fotky] Galerii se nepodařilo načíst:", chyba);
    return Response.json({ chyba: "Galerii se nepodařilo načíst." }, { status: 502 });
  }
}

/** Registrace fotky nahrané z mobilu přímo do Cloudinary. */
export async function POST(request: Request) {
  let telo: unknown;
  try {
    telo = await request.json();
  } catch {
    return Response.json({ chyba: "Neplatný požadavek." }, { status: 400 });
  }

  const { url, publicId, deviceId } = (telo ?? {}) as {
    url?: unknown;
    publicId?: unknown;
    deviceId?: unknown;
  };

  const device = overDeviceId(deviceId);
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  // bereme jen URL z našeho Cloudinary účtu — ať nám do galerie nikdo nepodstrčí cizí obsah
  const urlOk =
    typeof url === "string" &&
    !!cloud &&
    (url.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`) ||
      url.startsWith(`https://res.cloudinary.com/${cloud}/video/upload/`));

  if (!device || !urlOk || typeof publicId !== "string" || publicId.length > 300) {
    return Response.json({ chyba: "Neplatný požadavek." }, { status: 400 });
  }

  try {
    const id = await pridejFotku(url, publicId, device);
    return Response.json({ ok: true, id });
  } catch (chyba) {
    console.error("[fotky] Fotku se nepodařilo uložit:", chyba);
    return Response.json({ chyba: "Fotku se nepodařilo uložit." }, { status: 502 });
  }
}

/** Smazání vlastní fotky. */
export async function DELETE(request: Request) {
  let telo: unknown;
  try {
    telo = await request.json();
  } catch {
    return Response.json({ chyba: "Neplatný požadavek." }, { status: 400 });
  }

  const { id, deviceId } = (telo ?? {}) as { id?: unknown; deviceId?: unknown };
  const device = overDeviceId(deviceId);
  if (!device || typeof id !== "string" || !/^rec[A-Za-z0-9]{14}$/.test(id)) {
    return Response.json({ chyba: "Neplatný požadavek." }, { status: 400 });
  }

  try {
    const vysledek = await smazFotku(id, device);
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
