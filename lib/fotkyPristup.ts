import { cookies } from "next/headers";
import { chybaOdpoved } from "./chyby";
import { COOKIE_FOTKY, COOKIE_SPRAVCE, jeSpravcovskyToken, platnyToken } from "./pristup";

/** Heslo ke galerii z prostředí. Chybí-li, galerie zůstane zamčená pro všechny. */
export function hesloFotek(): string {
  const heslo = process.env.FOTKY_HESLO?.trim() ?? "";
  if (!heslo) console.error("[fotky] Chybí FOTKY_HESLO v prostředí — galerie je zamčená.");
  return heslo;
}

/** Zná tenhle prohlížeč odpověď? (platná cookie z /api/fotky/vstup) */
export async function maPristupKFotkam(): Promise<boolean> {
  const susenky = await cookies();
  const token = susenky.get(COOKIE_FOTKY)?.value;
  return platnyToken(token, hesloFotek());
}

/** Je tenhle prohlížeč přihlášený jako správce (galerie i /admin)? */
export async function jeSpravce(): Promise<boolean> {
  const susenky = await cookies();
  return jeSpravcovskyToken(susenky.get(COOKIE_SPRAVCE)?.value);
}

export const BEZ_PRISTUPU = () => chybaOdpoved("bez-pristupu");
