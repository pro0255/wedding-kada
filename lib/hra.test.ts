import { test } from "node:test";
import assert from "node:assert/strict";
import { sestavZebricek } from "./hra.ts";

test("nejlepší skóre na zařízení, seřazeno sestupně, jména doplněna", () => {
  const z = sestavZebricek(
    [
      { deviceId: "a", skore: 10 },
      { deviceId: "a", skore: 40 },
      { deviceId: "b", skore: 25 },
      { deviceId: "c", skore: 40 },
    ],
    new Map([["a", "Kada"]]),
    "b",
  );
  assert.deepEqual(
    z.radky.map((r) => [r.poradi, r.jmeno, r.skore, r.moje]),
    [
      [1, "Kada", 40, false],
      [1, "Neznámý host", 40, false],
      [3, "Neznámý host", 25, true],
    ],
  );
  assert.deepEqual(z.moje, { poradi: 3, skore: 25 });
});

test("limit ořízne řádky, ale moje pořadí zůstane", () => {
  const skore = Array.from({ length: 12 }, (_, i) => ({ deviceId: `d${i}`, skore: 100 - i }));
  const z = sestavZebricek(skore, new Map(), "d11", 10);
  assert.equal(z.radky.length, 10);
  assert.deepEqual(z.moje, { poradi: 12, skore: 89 });
});

test("bez mého skóre je moje undefined", () => {
  assert.equal(sestavZebricek([{ deviceId: "a", skore: 1 }], new Map(), "zzz").moje, undefined);
});
