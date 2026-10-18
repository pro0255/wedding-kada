import { cookies } from "next/headers";
import { COOKIE_FOTKY, platnyToken } from "./pristup";

/** Heslo ke galerii z prostředí. Chybí-li, galerie zůstane zamčená pro všechny. */
export function hesloFotek(): string {
  const heslo = process.env.FOTKY_HESLO?.trim() ?? "";
  if (!heslo) console.error("[fotky] Chybí FOTKY_HESLO v prostředí — galerie je zamčená.");
  return heslo;
}

/** Zná tenhle prohlížeč odpověď? (platná cookie z /api/fotky/vstup) */
export async function maPristupKFotkam(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE_FOTKY)?.value;
  return platnyToken(token, hesloFotek());
}

export const BEZ_PRISTUPU = () =>
  // bez jména psa — tuhle odpověď vidí i cizí
  Response.json({ chyba: "Nejdřív odpovězte na otázku u vstupu." }, { status: 401 });
