import assert from "node:assert/strict";
import { test } from "node:test";
import { jeCerstvy } from "./ubytovani.ts";

const stav = { obsazeno: 4, celkem: 26, volno: 22 };
const ted = Date.parse("2027-05-01T12:00:00Z");
const HODINA = 60 * 60_000;
const ulozeny = (staryMinut: number) => ({
  stav,
  rezervace: [],
  ulozeno: ted - staryMinut * 60_000,
});

test("stav mladší než limit se bere z paměti", () => {
  assert.equal(jeCerstvy(ulozeny(59), HODINA, ted), true);
});

test("starší stav, žádný nebo starý formát bez seznamu znamená zeptat se Airtable", () => {
  assert.equal(jeCerstvy(ulozeny(61), HODINA, ted), false);
  assert.equal(jeCerstvy(null, HODINA, ted), false);
  const bezSeznamu = { stav, ulozeno: ted } as unknown as Parameters<typeof jeCerstvy>[0];
  assert.equal(jeCerstvy(bezSeznamu, HODINA, ted), false);
});

test("admin chce čerstvější seznam než web", () => {
  assert.equal(jeCerstvy(ulozeny(10), HODINA, ted), true);
  assert.equal(jeCerstvy(ulozeny(10), 5 * 60_000, ted), false);
});
