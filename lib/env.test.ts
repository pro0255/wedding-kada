import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { EnvSchema, problemyEnv } from "./env.ts";

// vymyšlené hodnoty — skutečné jsou jen v .env.local a na Vercelu
const PLNE = {
  SVATBA_KV_REST_API_URL: "https://neco.upstash.io",
  SVATBA_KV_REST_API_TOKEN: "token",
  FOTKY_HESLO: "bara",
  FOTKY_SPRAVCE: "spravce",
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "cloud",
  NEXT_PUBLIC_CLOUDINARY_PRESET: "preset",
  CLOUDINARY_API_KEY: "klic",
  CLOUDINARY_API_SECRET: "tajemstvi",
  AIRTABLE_KEY: "airtable",
  WHATSAPP_SKUPINA: "https://chat.whatsapp.com/Vymyslena123",
};

test("se všemi povinnými projde, nepovinné chybět smí", () => {
  assert.deepEqual(problemyEnv(PLNE), []);
});

test("chybějící nebo prázdná proměnná se ohlásí i s popisem", () => {
  const problemy = problemyEnv({ ...PLNE, FOTKY_SPRAVCE: undefined, AIRTABLE_KEY: "  " });
  assert.deepEqual(
    problemy.map((p) => p.nazev),
    ["FOTKY_SPRAVCE", "AIRTABLE_KEY"],
  );
  assert.ok(problemy.every((p) => p.popis.length > 0));
});

test("WhatsApp musí být pozvánka do skupiny", () => {
  for (const spatne of ["https://zly.cz/x", "https://chat.whatsapp.com/Abc?s=qs", ""]) {
    assert.deepEqual(
      problemyEnv({ ...PLNE, WHATSAPP_SKUPINA: spatne }).map((p) => p.nazev),
      ["WHATSAPP_SKUPINA"],
    );
  }
});

test("adresa Redisu musí být URL", () => {
  assert.deepEqual(
    problemyEnv({ ...PLNE, SVATBA_KV_REST_API_URL: "neco" }).map((p) => p.nazev),
    ["SVATBA_KV_REST_API_URL"],
  );
});

test("každá proměnná, kterou kód čte, je ve schématu", () => {
  // VERCEL_* a NODE_ENV nastavuje platforma, ty se nekontrolují
  /* Dřív to hledal přes `git grep`, jenže execSync pouští na Windows
     cmd.exe a vzor v apostrofech se tam nerozparsuje. Projít soubory
     v Node je navíc rychlejší a nepotřebuje to git. */
  const korenAdresare = fileURLToPath(new URL("..", import.meta.url));
  const zdroje: string[] = [];
  const projdi = (misto: string) => {
    for (const polozka of readdirSync(misto, { withFileTypes: true })) {
      const cesta = path.join(misto, polozka.name);
      if (polozka.isDirectory()) projdi(cesta);
      else if (/.(ts|tsx|mjs)$/.test(polozka.name)) {
        zdroje.push(...(readFileSync(cesta, "utf8").match(/process.env.[A-Z_0-9]+/g) ?? []));
      }
    }
  };
  for (const kde of ["app", "lib"]) projdi(path.join(korenAdresare, kde));
  zdroje.push(
    ...(readFileSync(path.join(korenAdresare, "proxy.ts"), "utf8").match(
      /process.env.[A-Z_0-9]+/g,
    ) ?? []),
  );
  const ctene = new Set(zdroje.map((r) => r.slice("process.env.".length)));
  const chybi = [...ctene].filter(
    (n) => !(n in EnvSchema.shape) && n !== "NODE_ENV" && !n.startsWith("VERCEL_"),
  );
  assert.deepEqual(chybi, [], "doplň je do EnvSchema v lib/env.ts");
});
