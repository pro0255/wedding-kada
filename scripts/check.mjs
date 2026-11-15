/* Kontrola repozitáře — pouští se před každým commitem (.husky/pre-commit)
   a v GitHub Actions před nasazením.

   Použití:
     node scripts/check.mjs                 všechno: format, lint, type, test, knip
     node scripts/check.mjs lint test       jen vybrané
     node scripts/check.mjs --fix           format a lint rovnou opraví, zbytek zkontroluje

   Úkoly běží souběžně, na konci je report: co prošlo, co ne a jak dlouho to trvalo.
   Výstup úkolu se vypíše jen tehdy, když neprošel. */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const UKOLY = {
  format: { popis: "formát (oxfmt)", cmd: ["oxfmt", "--check"], fix: ["oxfmt"] },
  lint: {
    popis: "lint (oxlint)",
    cmd: ["oxlint", "-c", ".oxlintrc.json"],
    fix: ["oxlint", "--fix", "-c", ".oxlintrc.json"],
  },
  type: { popis: "typy (tsc)", cmd: ["tsc", "--noEmit"] },
  test: { popis: "testy (node --test)", cmd: ["npm", "test", "--silent"] },
  // knip načítá next.config.ts, který bez proměnných prostředí spadne
  knip: {
    popis: "nepoužitý kód (knip)",
    cmd: ["npm", "run", "knip", "--silent"],
    jenKdyz: () => existsSync(".env.local"),
    proc: "chybí .env.local",
  },
};

const args = process.argv.slice(2);
const fix = args.includes("--fix");
const vybrane = args.filter((a) => !a.startsWith("-"));
const neznamy = vybrane.find((a) => !(a in UKOLY));
if (neznamy) {
  console.error(`check: neznámý úkol „${neznamy}“ — umím: ${Object.keys(UKOLY).join(", ")}`);
  process.exit(2);
}
const jmena = vybrane.length > 0 ? vybrane : Object.keys(UKOLY);

function spust(jmeno) {
  const ukol = UKOLY[jmeno];
  if (ukol.jenKdyz && !ukol.jenKdyz()) {
    return Promise.resolve({ jmeno, stav: "přeskočeno", ms: 0, vystup: ukol.proc });
  }
  const [prikaz, ...parametry] = (fix && ukol.fix) || ukol.cmd;
  const start = Date.now();
  return new Promise((vyres) => {
    const p = spawn(prikaz, parametry, {
      env: {
        ...process.env,
        PATH: `node_modules/.bin${process.platform === "win32" ? ";" : ":"}${process.env.PATH}`,
        FORCE_COLOR: "0",
      },
      shell: process.platform === "win32",
    });
    let vystup = "";
    p.stdout.on("data", (d) => (vystup += d));
    p.stderr.on("data", (d) => (vystup += d));
    p.on("error", (e) =>
      vyres({ jmeno, stav: "chyba", ms: Date.now() - start, vystup: String(e) }),
    );
    p.on("close", (kod) =>
      vyres({ jmeno, stav: kod === 0 ? "ok" : "chyba", ms: Date.now() - start, vystup }),
    );
  });
}

const start = Date.now();
// s --fix po sobě (format a lint přepisují tytéž soubory), jinak souběžně
const vysledky = [];
if (fix) {
  for (const j of jmena) vysledky.push(await spust(j));
} else {
  vysledky.push(...(await Promise.all(jmena.map((j) => spust(j)))));
}

const spatne = vysledky.filter((v) => v.stav === "chyba");
for (const v of spatne) {
  console.log(`\n── ${UKOLY[v.jmeno].popis} ─ neprošlo ${"─".repeat(40)}`);
  console.log(v.vystup.trim() || "(bez výstupu)");
}

const ZNAK = { ok: "✓", chyba: "✗", přeskočeno: "–" };
console.log(`\nKontrola${fix ? " (s opravou)" : ""}:`);
for (const v of vysledky) {
  const cas = v.stav === "přeskočeno" ? v.vystup : `${(v.ms / 1000).toFixed(1)} s`;
  console.log(`  ${ZNAK[v.stav]} ${UKOLY[v.jmeno].popis.padEnd(24)} ${cas}`);
}
const ok = vysledky.filter((v) => v.stav === "ok").length;
console.log(
  `\n${spatne.length === 0 ? "V pořádku" : "NEPROŠLO"} — ${ok}/${vysledky.length} za ${((Date.now() - start) / 1000).toFixed(1)} s` +
    (spatne.length > 0 && !fix ? "  (zkus: npm run check:fix)" : ""),
);
process.exit(spatne.length === 0 ? 0 : 1);
