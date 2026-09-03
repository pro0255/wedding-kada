import { NextResponse, type NextRequest } from "next/server";
import { poSvatbe } from "@/lib/svatba";

/**
 * Po svatbě vede hlavní stránka na /podekovani. Původní web zůstává
 * dostupný přes /?svatba=1 (odkazy z oznámení, nostalgie).
 * Náhled poděkování před svatbou: /?nahled=podekovani.
 */
export function proxy(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  if (searchParams.has("svatba")) return NextResponse.next();
  if (poSvatbe() || searchParams.get("nahled") === "podekovani") {
    return NextResponse.redirect(new URL("/podekovani", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: "/" };
