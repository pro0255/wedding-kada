import { cookies } from "next/headers";
import { hesloFotek, maPristupKFotkam } from "@/lib/fotkyPristup";
import { COOKIE_FOTKY, COOKIE_FOTKY_MAX_AGE, jeSpravnaOdpoved, tokenPristupu } from "@/lib/pristup";
import { KLIC, redis } from "@/lib/redis";
import { VstupPostSchema } from "@/lib/schemata";

/* Vstup do galerie fotek. Odpověď na otázku zná jen server (FOTKY_HESLO),
   prohlížeč po správné odpovědi dostane httpOnly cookie a ostatní API fotek
   ji kontroluje. Hádání brzdí limit špatných pokusů na IP. */

const MAX_POKUSU = 8; // špatných odpovědí za minutu z jedné adresy
const OKNO_S = 60;

/** Pustí pes hosta rovnou? Cookie je httpOnly, prohlížeč se musí zeptat. */
export async function GET() {
  return Response.json({ pristup: await maPristupKFotkam() });
}

export async function POST(request: Request) {
  const telo = VstupPostSchema.safeParse(await request.json().catch(() => null));
  if (!telo.success) return Response.json({ chyba: "Neplatný požadavek." }, { status: 400 });

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "neznama";
  const klic = KLIC.vstupPokusy(ip);
  // výpadek Redisu nesmí zamknout hosty — limit se pak jen nepočítá
  const pokusy = await redis().get<number>(klic).catch(() => 0);
  if ((pokusy ?? 0) >= MAX_POKUSU) {
    return Response.json({ ok: false, chyba: "moc-pokusu" }, { status: 429 });
  }

  const heslo = hesloFotek();
  if (!jeSpravnaOdpoved(telo.data.odpoved, heslo)) {
    await redis()
      .multi()
      .incr(klic)
      .expire(klic, OKNO_S)
      .exec()
      .catch((chyba) => console.error("[fotky] Pokus se nepodařilo započítat:", chyba));
    return Response.json({ ok: false }, { status: 401 });
  }

  (await cookies()).set(COOKIE_FOTKY, tokenPristupu(heslo), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_FOTKY_MAX_AGE,
  });
  return Response.json({ ok: true });
}
