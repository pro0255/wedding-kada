import { z } from "zod";

/**
 * Proměnné prostředí, bez kterých web nemá smysl pouštět. Kontroluje je
 * next.config.ts při `next dev`, `next build` i `next start` — když něco
 * chybí, web se nespustí a vypíše, co doplnit. Na Vercelu tak neprojde
 * build a produkce zůstane na poslední funkční verzi.
 *
 * Tohle schéma je jediný seznam proměnných, které web používá — nová
 * proměnná patří sem, i s popisem, který se ukáže, když chybí. Sem patří
 * jen názvy a k čemu jsou, nikdy hodnoty (repozitář je veřejný).
 * Vzor: env/server.ts v ravineo-frontend (t3 createEnv).
 */
const povinna = (popis: string) => z.string().trim().min(1).describe(popis);
// bez nepovinné web běží, jen danou věc vynechá nebo vezme náhradní hodnotu
const nepovinna = (popis: string) => z.string().optional().describe(popis);

export const EnvSchema = z.object({
  SVATBA_KV_REST_API_URL: z.url().describe("Upstash Redis — adresa (fotky, lajky, skóre, jména)"),
  SVATBA_KV_REST_API_TOKEN: povinna("Upstash Redis — token"),

  FOTKY_HESLO: povinna("odpověď na otázku u vstupu do galerie fotek"),
  FOTKY_SPRAVCE: povinna("správcovské heslo galerie (smí smazat i cizí fotku)"),

  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: povinna("Cloudinary — název účtu (upload fotek)"),
  NEXT_PUBLIC_CLOUDINARY_PRESET: povinna("Cloudinary — unsigned upload preset"),
  CLOUDINARY_API_KEY: povinna("Cloudinary — API klíč (mazání souborů)"),
  CLOUDINARY_API_SECRET: povinna("Cloudinary — API secret (mazání souborů)"),

  AIRTABLE_KEY: povinna("Airtable — kapacita a rezervace ubytování"),

  RESEND_API_KEY: nepovinna("Resend — mail o nové rezervaci ubytování; bez něj se mail neposílá"),
  NOTIFY_EMAIL: nepovinna("komu chodí mail o rezervaci ubytování"),
  MAIL_FROM: nepovinna("odesílatel mailu; bez něj onboarding@resend.dev"),
  NEXT_PUBLIC_WEB_URL: nepovinna("adresa webu pro OG obrázek; bez ní produkční doména z Vercelu"),
});

export type EnvProblem = { nazev: string; popis: string };

/** Co v prostředí chybí nebo je neplatné. Prázdné pole = web se smí pustit. */
export function problemyEnv(env: Record<string, string | undefined>): EnvProblem[] {
  const vysledek = EnvSchema.safeParse(env);
  if (vysledek.success) return [];
  const nazvy = [...new Set(vysledek.error.issues.map((i) => String(i.path[0])))];
  return nazvy.map((nazev) => ({
    nazev,
    popis: EnvSchema.shape[nazev as keyof typeof EnvSchema.shape]?.description ?? "",
  }));
}

/** Když něco chybí, vypíše co a ukončí proces — web se nespustí. */
export function zkontrolujEnv(env: Record<string, string | undefined> = process.env): void {
  const problemy = problemyEnv(env);
  if (problemy.length === 0) return;

  const sirka = Math.max(...problemy.map((p) => p.nazev.length));
  console.error(
    [
      "",
      "✖ Web se nespustí — chybí nebo jsou neplatné proměnné prostředí:",
      "",
      ...problemy.map((p) => `  • ${p.nazev.padEnd(sirka)}  ${p.popis}`),
      "",
      "  Lokálně je doplň do .env.local (seznam všech je v lib/env.ts).",
      "  Na Vercelu: vercel env add <NÁZEV> production",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
