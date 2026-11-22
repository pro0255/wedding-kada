import assert from "node:assert/strict";
import { test } from "node:test";
import { jeCerstvy } from "./ubytovani.ts";

const stav = { obsazeno: 4, celkem: 26, volno: 22 };
const ted = Date.parse("2027-05-01T12:00:00Z");

test("stav mladší než hodina se bere z paměti", () => {
  assert.equal(jeCerstvy({ stav, ulozeno: ted - 59 * 60_000 }, ted), true);
});

test("starší stav nebo žádný znamená zeptat se Airtable", () => {
  assert.equal(jeCerstvy({ stav, ulozeno: ted - 61 * 60_000 }, ted), false);
  assert.equal(jeCerstvy(null, ted), false);
});
