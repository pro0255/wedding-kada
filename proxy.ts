import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SPRAVCE, jeSpravcovskyToken } from "@/lib/pristup";
import { poSvatbe } from "@/lib/svatba";

/**
 * Dvě věci před vykreslením stránky:
 *
 * 1. Stránky jen pro snoubence (oznámení, návrhy) pustí jen správce —
 *    platná cookie ze správcovského hesla. Ostatní přesměruje na /admin,
 *    kde se přihlásí a vrátí se, kam mířili (?dal=).
 *    Nová taková stránka = přidat ji do `matcher` dole i do rozcestníku
 *    v app/admin/page.tsx.
 *
 * 2. Po svatbě vede hlavní stránka na /podekovani. Původní web zůstává
 *    dostupný přes /?svatba=1 (odkazy z oznámení, nostalgie).
 *    Náhled poděkování před svatbou: /?nahled=podekovani.
 */
export function proxy(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  if (pathname !== "/") {
    if (jeSpravcovskyToken(request.cookies.get(COOKIE_SPRAVCE)?.value)) return NextResponse.next();
    const prihlaseni = new URL("/admin", request.url);
    prihlaseni.searchParams.set("dal", pathname + search);
    return NextResponse.redirect(prihlaseni);
  }

  if (searchParams.has("svatba")) return NextResponse.next();
  if (poSvatbe() || searchParams.get("nahled") === "podekovani") {
    return NextResponse.redirect(new URL("/podekovani", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/", "/oznameni", "/navrh/:path*"] };
