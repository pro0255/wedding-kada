import { test } from "node:test";
import assert from "node:assert/strict";
import { cekatDo, pauzaPredPokusem, posudChybu, vyberDalsi } from "./frontaNahravani.ts";

test("pauza mezi pokusy roste a zastaví se na minutě", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 50].map(pauzaPredPokusem), [2000, 5000, 15000, 30000, 60000, 60000, 60000]);
  assert.equal(pauzaPredPokusem(0), 2000);
});

test("síť a chyby serveru se zkouší znovu, odmítnutý soubor ne", () => {
  for (const s of [0, 408, 429, 500, 502, 503]) assert.equal(posudChybu(s), "znovu", String(s));
  for (const s of [400, 403, 404, 413]) assert.equal(posudChybu(s), "vzdat", String(s));
  assert.equal(posudChybu(401), "zamceno");
});

test("nahrává se nejstarší položka, na kterou došla řada", () => {
  const polozky = [
    { id: "a", pridano: 1, dalsiPokus: 500 }, // nejstarší, ale ještě čeká po chybě
    { id: "b", pridano: 2, dalsiPokus: 0 },
    { id: "c", pridano: 3, dalsiPokus: 0 },
  ];
  assert.equal(vyberDalsi(polozky, 100)?.id, "b");
  assert.equal(vyberDalsi(polozky, 500)?.id, "a");
  assert.equal(vyberDalsi([{ id: "a", pridano: 1, dalsiPokus: 500 }], 100), null);
  assert.equal(cekatDo([{ id: "a", pridano: 1, dalsiPokus: 500 }, { id: "b", pridano: 2, dalsiPokus: 300 }], 100), 200);
});
