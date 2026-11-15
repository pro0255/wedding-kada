import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHYBY,
  ChybaOdpovedSchema,
  KODY_CHYB,
  chyba,
  chybaOdpoved,
  chybaZOdpovedi,
  chybaZVyjimky,
  prectiChybu,
} from "./chyby.ts";

test("každý kód má hlášku a rozumný stavový kód", () => {
  for (const kod of KODY_CHYB) {
    const p = CHYBY[kod];
    assert.ok(p.hlaska.trim().length > 0, kod);
    assert.ok(p.status === 0 || (p.status >= 400 && p.status < 600), kod);
  }
  assert.deepEqual(Object.keys(CHYBY).sort(), [...KODY_CHYB].sort());
});

test("chybaOdpoved pošle kód, hlášku a stav z katalogu", async () => {
  const r = chybaOdpoved("rezervace-neulozena");
  assert.equal(r.status, 502);
  const telo = await r.json();
  assert.deepEqual(telo, { kod: "rezervace-neulozena", chyba: CHYBY["rezervace-neulozena"].hlaska });
  assert.equal(ChybaOdpovedSchema.safeParse(telo).success, true);
});

test("chybaOdpoved přibalí data a přepíše hlášku, kód přepsat nejde", async () => {
  const r = chybaOdpoved("rezervace-malo-mist", { hlaska: "Zbývají 2.", stav: { volno: 2 }, kod: "x" });
  assert.equal(r.status, 409);
  assert.deepEqual(await r.json(), { kod: "rezervace-malo-mist", chyba: "Zbývají 2.", stav: { volno: 2 } });
});

test("prectiChybu vrátí typovanou chybu ze serveru", async () => {
  const c = await prectiChybu(chybaOdpoved("fotka-cizi"));
  assert.deepEqual(c, chyba("fotka-cizi"));
  assert.equal(c.kontakt, true);
});

test("neznámé tělo se odhadne ze stavového kódu", async () => {
  assert.equal(chybaZOdpovedi(401, null).kod, "bez-pristupu");
  assert.equal(chybaZOdpovedi(429, { chyba: "moc-pokusu" }).kod, "moc-pokusu");
  assert.equal(chybaZOdpovedi(504, "<html>").kod, "server");
  assert.equal(chybaZOdpovedi(400, { kod: "vymysleny", chyba: "x" }).kod, "neplatny-pozadavek");
  // stránka Vercelu místo JSON
  const html = new Response("<html>504</html>", { status: 504 });
  assert.equal((await prectiChybu(html)).kod, "server");
});

test("výpadek sítě se pozná podle TypeError z fetch", () => {
  assert.equal(chybaZVyjimky(new TypeError("Failed to fetch")).kod, "sit");
  assert.equal(chybaZVyjimky(new Error("něco")).kod, "neznama");
  assert.equal(chybaZVyjimky(new TypeError("x")).kontakt, false);
});
