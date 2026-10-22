import { cookies } from "next/headers";
import { hesloFotek, hesloSpravce, jeSpravce, maPristupKFotkam } from "@/lib/fotkyPristup";
import {
  COOKIE_FOTKY,
  COOKIE_FOTKY_MAX_AGE,
  COOKIE_SPRAVCE,
  jeSpravnaOdpoved,
  tokenPristupu,
} from "@/lib/pristup";
import { KLIC, maRedis, redis } from "@/lib/redis";
import { VstupPostSchema } from "@/lib/schemata";

/* Vstup do galerie fotek. Odpověď na otázku zná jen server (FOTKY_HESLO),
   prohlížeč po správné odpovědi dostane httpOnly cookie a ostatní API fotek
   ji kontroluje. Hádání brzdí limit špatných pokusů na IP. */

const MAX_POKUSU = 8; // špatných odpovědí za minutu z jedné adresy
const OKNO_S = 60;

/** Pustí pes hosta rovnou? Cookie je httpOnly, prohlížeč se musí zeptat. */
export async function GET() {
  return Response.json({ pristup: await maPristupKFotkam(), spravce: await jeSpravce() });
}

/** Konec správcovství — host zůstane hostem. */
export async function DELETE() {
  (await cookies()).delete(COOKIE_SPRAVCE);
  return Response.json({ ok: true });
}

/* Brzda na hádání. Redis je pro ni jen počítadlo — když v prostředí chybí
   nebo vypadne, limit se nepočítá a host projde na správnou odpověď.
   Dřív se o něj route opřela hned prvním příkazem: redis() hodí výjimku
   ještě před vznikem slibu, takže ji .catch() nechytil a vstup vracel 500.
   Galerii drží odpověď, ne tohle — výpadek počítadla ji nesmí zamknout. */
async function spatnePokusy(klic: string): Promise<number> {
  if (!maRedis()) return 0;
  try {
    return (await redis().get<number>(klic)) ?? 0;
  } catch (chyba) {
    console.warn("[fotky] počítadlo pokusů je nedostupné, limit se nepočítá", chyba);
    return 0;
  }
}

async function zapocitejPokus(klic: string): Promise<void> {
  if (!maRedis()) return;
  try {
    await redis().multi().incr(klic).expire(klic, OKNO_S).exec();
  } catch (chyba) {
    console.error("[fotky] Pokus se nepodařilo započítat:", chyba);
  }
}

export async function POST(request: Request) {
  const telo = VstupPostSchema.safeParse(await request.json().catch(() => null));
  if (!telo.success) return Response.json({ chyba: "Neplatný požadavek." }, { status: 400 });

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "neznama";
  const klic = KLIC.vstupPokusy(ip);
  const pokusy = await spatnePokusy(klic);
  if (pokusy >= MAX_POKUSU) {
    return Response.json({ ok: false, chyba: "moc-pokusu" }, { status: 429 });
  }

  /* U dveří stojí jedno pole, ale hesla jsou dvě. Jméno psa pustí hosta,
     správcovské heslo pustí dál i jako správce — ten pak smí smazat
     cizí fotku. Nikde to není napsané, dveře jsou pořád jedny. */
  const heslo = hesloFotek();
  const spravcovske = hesloSpravce();
  const jakoSpravce = jeSpravnaOdpoved(telo.data.odpoved, spravcovske);

  if (!jakoSpravce && !jeSpravnaOdpoved(telo.data.odpoved, heslo)) {
    await zapocitejPokus(klic);
    return Response.json({ ok: false }, { status: 401 });
  }

  const nastaveni = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_FOTKY_MAX_AGE,
  };
  const uloz = await cookies();
  uloz.set(COOKIE_FOTKY, tokenPristupu(heslo), nastaveni);
  if (jakoSpravce) uloz.set(COOKIE_SPRAVCE, tokenPristupu(spravcovske, "spravce"), nastaveni);
  return Response.json({ ok: true, spravce: jakoSpravce });
}
