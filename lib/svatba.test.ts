import { test } from "node:test";
import assert from "node:assert/strict";
import { poSvatbe } from "./svatba.ts";

test("před svatbou a v noci po ní web zůstává svatební", () => {
  assert.equal(poSvatbe(new Date("2027-09-17T10:00:00+02:00")), false);
  assert.equal(poSvatbe(new Date("2027-09-18T23:59:00+02:00")), false);
  assert.equal(poSvatbe(new Date("2027-09-19T03:00:00+02:00")), false);
});

test("od rána po svatbě se přepíná na poděkování", () => {
  assert.equal(poSvatbe(new Date("2027-09-19T08:00:00+02:00")), true);
  assert.equal(poSvatbe(new Date("2028-01-01T00:00:00+01:00")), true);
});
