/**
 * Jednorázový přesun fotek, lajků, skóre a jmen z Airtable do Redisu.
 * Rezervace ubytování zůstávají v Airtable. Spuštění:
 *   node --env-file=.env.local scripts/airtable-do-redis.mjs
 * Přepíše jen klíče svatba:* pro tahle data; běh navíc nic nezdvojí.
 */
import { Redis } from "@upstash/redis";

const BASE_ID = "appw1s9BtzlKCPous";
const HRY = ["zenich", "husky", "prsten"];

const redis = new Redis({
  url: process.env.SVATBA_KV_REST_API_URL,
  token: process.env.SVATBA_KV_REST_API_TOKEN,
});

async function tabulka(nazev) {
  const zaznamy = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(nazev)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.AIRTABLE_KEY}` } });
    if (!r.ok) throw new Error(`${nazev}: Airtable vrátil ${r.status}: ${await r.text()}`);
    const data = await r.json();
    zaznamy.push(...data.records);
    offset = data.offset;
  } while (offset);
  return zaznamy;
}

const [fotky, lajky, skore, hoste] = await Promise.all(
  ["Fotky", "Lajky", "Skore", "Hoste"].map(tabulka),
);

const p = redis.pipeline();

const fotkyHash = {};
for (const f of fotky) {
  if (!f.fields.Url) continue;
  fotkyHash[f.id] = {
    url: f.fields.Url,
    publicId: f.fields.PublicId ?? "",
    deviceId: f.fields.DeviceId ?? "",
    nahrano: f.fields["Nahráno"] ?? "",
  };
}
if (Object.keys(fotkyHash).length) p.hset("svatba:fotky", fotkyHash);

const lajkyClenove = lajky
  .filter((l) => l.fields.FotkaId && l.fields.DeviceId && fotkyHash[l.fields.FotkaId])
  .map((l) => `${l.fields.FotkaId}:${l.fields.DeviceId}`);
if (lajkyClenove.length) p.sadd("svatba:lajky", ...lajkyClenove);

const jmena = {};
for (const h of hoste) if (h.fields.DeviceId && h.fields["Jméno"]) jmena[h.fields.DeviceId] = h.fields["Jméno"];
if (Object.keys(jmena).length) p.hset("svatba:hoste", jmena);

let pocetSkore = 0;
for (const s of skore) {
  const { Hra, DeviceId } = s.fields;
  const b = s.fields["Skóre"];
  if (!HRY.includes(Hra) || !DeviceId || typeof b !== "number") continue;
  p.zadd(`svatba:skore:${Hra}`, { gt: true }, { score: b, member: DeviceId });
  pocetSkore++;
}

if (p.length()) await p.exec();
console.log(
  `Hotovo: ${Object.keys(fotkyHash).length} fotek, ${lajkyClenove.length} lajků, ` +
    `${Object.keys(jmena).length} jmen, ${pocetSkore} skóre.`,
);
