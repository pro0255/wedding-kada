/**
 * Úklid testovacích dat před ostrým provozem: skóre her, jména hostů,
 * fotky s lajky (i soubory v Cloudinary), počítadla pokusů u vstupu
 * a vybrané rezervace v Airtable.
 *
 * Bez --ostre nic nemaže, jen vypíše, co by smazal:
 *   node --env-file=.env.local scripts/uklid.mjs
 *   node --env-file=.env.local scripts/uklid.mjs --ostre
 *
 * Volby:
 *   --jen=hry,jmena,fotky,pokusy   jen vybrané části (výchozí všechny čtyři)
 *   --rezervace                    vypíše rezervace z Airtable i s id (1 volání API)
 *   --smaz-rezervace=recA,recB     smaže tyhle rezervace (jen s --ostre)
 *
 * Rezervace se nikdy nemažou hromadně — můžou mezi nimi být skutečné.
 * Staré tabulky Fotky, Lajky, Skore, Hoste v Airtable web už nepoužívá
 * (data jsou v Redisu), ty smaž rovnou v Airtable — přes API by mazání
 * záznamů ukrajovalo z limitu 1 000 volání měsíčně.
 */
import { Redis } from "@upstash/redis";

const BASE_ID = "appw1s9BtzlKCPous";
const HRY = ["zenich", "husky", "prsten"];
const CASTI = ["hry", "jmena", "fotky", "pokusy"];

const argumenty = process.argv.slice(2);
const volba = (nazev) => argumenty.find((a) => a.startsWith(`--${nazev}=`))?.split("=")[1];
const ostre = argumenty.includes("--ostre");
const casti = new Set(volba("jen")?.split(",") ?? CASTI);
const smazRezervace = volba("smaz-rezervace")?.split(",").filter(Boolean) ?? [];

for (const c of casti) {
  if (!CASTI.includes(c)) throw new Error(`Neznámá část „${c}“ — znám ${CASTI.join(", ")}.`);
}
for (const id of smazRezervace) {
  if (!/^rec\w{14}$/.test(id)) throw new Error(`„${id}“ nevypadá jako id záznamu z Airtable.`);
}

const env = (nazev) => {
  const hodnota = process.env[nazev];
  if (!hodnota) throw new Error(`Chybí ${nazev} — spusť s --env-file=.env.local.`);
  return hodnota;
};

const redis = new Redis({
  url: env("SVATBA_KV_REST_API_URL"),
  token: env("SVATBA_KV_REST_API_TOKEN"),
});

const klice = [];
const radky = [];
const pridej = (klic, popis) => {
  klice.push(klic);
  radky.push(`  ${popis}`);
};

if (casti.has("hry")) {
  for (const hra of HRY) {
    pridej(`svatba:skore:${hra}`, `skóre ${hra}: ${await redis.zcard(`svatba:skore:${hra}`)}`);
  }
}

if (casti.has("jmena")) {
  pridej("svatba:hoste", `jména hostů: ${await redis.hlen("svatba:hoste")}`);
}

/** @type {{ publicId: string; typ: "image" | "video" }[]} */
let soubory = [];
if (casti.has("fotky")) {
  const fotky = (await redis.hgetall("svatba:fotky")) ?? {};
  soubory = Object.values(fotky)
    .filter((f) => f.publicId)
    .map((f) => ({
      publicId: f.publicId,
      typ: f.url.includes("/video/upload/") ? "video" : "image",
    }));
  pridej("svatba:fotky", `fotky a videa v galerii: ${Object.keys(fotky).length}`);
  pridej("svatba:lajky", `lajky: ${await redis.scard("svatba:lajky")}`);
  radky.push(`  soubory v Cloudinary k smazání: ${soubory.length}`);
}

if (casti.has("pokusy")) {
  let kurzor = "0";
  let pocet = 0;
  do {
    const [dalsi, nalezene] = await redis.scan(kurzor, { match: "svatba:vstup:*", count: 200 });
    kurzor = String(dalsi);
    klice.push(...nalezene);
    pocet += nalezene.length;
  } while (kurzor !== "0");
  radky.push(`  počítadla špatných pokusů u vstupu do galerie: ${pocet}`);
}

async function airtable(cesta, init = {}) {
  const r = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${cesta}`, {
    ...init,
    headers: { Authorization: `Bearer ${env("AIRTABLE_KEY")}` },
  });
  if (!r.ok) throw new Error(`Airtable vrátil ${r.status}: ${await r.text()}`);
  return r.json();
}

if (argumenty.includes("--rezervace")) {
  const data = await airtable(`Rezervace?pageSize=100`);
  console.log(`Rezervace v Airtable (${data.records.length}${data.offset ? "+" : ""}):`);
  for (const z of data.records) {
    const f = z.fields;
    console.log(
      `  ${z.id}  ${f["Jméno hosta"] ?? "?"} · ${f["Počet osob"] ?? "?"} os. · ${f.Status ?? "?"}`,
    );
  }
  console.log();
}

console.log(ostre ? "Mažu:" : "Smazalo by se (spusť s --ostre):");
console.log(radky.join("\n"));
if (smazRezervace.length > 0) console.log(`  rezervace v Airtable: ${smazRezervace.join(", ")}`);

if (!ostre) process.exit(0);

// Cloudinary napřed: když selže, záznamy v Redisu zůstanou a běh jde zopakovat
if (soubory.length > 0) {
  const cloud = env("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME");
  const auth = Buffer.from(`${env("CLOUDINARY_API_KEY")}:${env("CLOUDINARY_API_SECRET")}`).toString(
    "base64",
  );
  for (const typ of ["image", "video"]) {
    const ids = soubory.filter((s) => s.typ === typ).map((s) => s.publicId);
    for (let i = 0; i < ids.length; i += 100) {
      const url = new URL(`https://api.cloudinary.com/v1_1/${cloud}/resources/${typ}/upload`);
      for (const id of ids.slice(i, i + 100)) url.searchParams.append("public_ids[]", id);
      const r = await fetch(url, { method: "DELETE", headers: { Authorization: `Basic ${auth}` } });
      if (!r.ok) throw new Error(`Cloudinary vrátil ${r.status}: ${await r.text()}`);
    }
  }
}

if (smazRezervace.length > 0) {
  for (let i = 0; i < smazRezervace.length; i += 10) {
    const dotaz = smazRezervace
      .slice(i, i + 10)
      .map((id) => `records[]=${id}`)
      .join("&");
    await airtable(`Rezervace?${dotaz}`, { method: "DELETE" });
  }
  // web by jinak hodinu ukazoval obsazenost i se smazanými rezervacemi
  klice.push("svatba:ubytovani:posledni", "svatba:ubytovani:zamek");
}

if (klice.length > 0) await redis.del(...klice);
console.log("Hotovo.");
