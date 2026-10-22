import { test } from "node:test";
import assert from "node:assert/strict";
import { jeSpravnaOdpoved, normalizuj, platnyToken, tokenPristupu } from "./pristup.ts";

// heslo v testu je vymyšlené — skutečné je jen v proměnné prostředí
const HESLO = "Bára";

test("odpověď nezávisí na velikosti písmen, diakritice ani mezerách", () => {
  assert.equal(normalizuj("  BÁRA "), "bara");
  assert.ok(jeSpravnaOdpoved("bara", HESLO));
  assert.ok(jeSpravnaOdpoved(" BÁRA ", HESLO));
  assert.ok(!jeSpravnaOdpoved("barka", HESLO));
  assert.ok(!jeSpravnaOdpoved("", HESLO));
});

test("bez nastaveného hesla neprojde nic", () => {
  assert.ok(!jeSpravnaOdpoved("", ""));
  assert.ok(!jeSpravnaOdpoved("cokoli", "  "));
  assert.ok(!platnyToken(tokenPristupu(""), ""));
});

test("token hosta neotevře správcovský režim a naopak", () => {
  // host a správce mají jiné heslo i jinou zprávu v podpisu
  const hostuv = tokenPristupu(HESLO);
  const spravcuv = tokenPristupu(HESLO, "spravce");
  assert.notEqual(hostuv, spravcuv);
  assert.ok(!platnyToken(hostuv, HESLO, "spravce"));
  assert.ok(!platnyToken(spravcuv, HESLO));
  assert.ok(platnyToken(spravcuv, HESLO, "spravce"));
});

test("token platí jen pro své heslo", () => {
  const t = tokenPristupu(HESLO);
  assert.ok(platnyToken(t, HESLO));
  assert.ok(platnyToken(t, "bára")); // stejné heslo jinak napsané
  assert.ok(!platnyToken(t, "Jiné"));
  assert.ok(!platnyToken(undefined, HESLO));
  assert.ok(!platnyToken(t.slice(1), HESLO));
});
