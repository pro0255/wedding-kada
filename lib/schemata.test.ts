import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AdminDalSchema,
  HraSchema,
  JmenoSchema,
  RezervacePostSchema,
  SkorePostSchema,
  SkoreSchema,
} from "./schemata.ts";

test("SkoreSchema bere jen celá čísla 0–100000", () => {
  assert.equal(SkoreSchema.safeParse(12).success, true);
  assert.equal(SkoreSchema.safeParse(0).success, true);
  assert.equal(SkoreSchema.safeParse(12.5).success, false);
  assert.equal(SkoreSchema.safeParse(-1).success, false);
  assert.equal(SkoreSchema.safeParse(100_001).success, false);
  assert.equal(SkoreSchema.safeParse("12").success, false);
});

test("HraSchema zná jen tři hry", () => {
  assert.equal(HraSchema.safeParse("husky").success, true);
  assert.equal(HraSchema.safeParse("tetris").success, false);
});

test("JmenoSchema ořeže mezery a přijme 1–30 znaků", () => {
  assert.equal(JmenoSchema.parse("  Kada  "), "Kada");
  assert.equal(JmenoSchema.parse("Jakub Pytlík"), "Jakub Pytlík");
  assert.equal(JmenoSchema.safeParse("").success, false);
  assert.equal(JmenoSchema.safeParse("   ").success, false);
  assert.equal(JmenoSchema.safeParse("a".repeat(31)).success, false);
  assert.equal(JmenoSchema.safeParse(42).success, false);
});

test("JmenoSchema odmítne řídicí znaky", () => {
  assert.equal(JmenoSchema.safeParse("Ka\u0007da").success, false);
  assert.equal(JmenoSchema.safeParse("Ka\nda").success, false);
});

test("SkorePostSchema odmítne cizí deviceId", () => {
  assert.equal(
    SkorePostSchema.safeParse({ hra: "zenich", deviceId: "<script>", skore: 1 }).success,
    false,
  );
  assert.equal(
    SkorePostSchema.safeParse({
      hra: "zenich",
      deviceId: "11111111-1111-4111-8111-111111111111",
      skore: 1,
    }).success,
    true,
  );
});

test("RezervacePostSchema: očistí jméno, hlásí první chybu hostovi", () => {
  const ok = RezervacePostSchema.safeParse({ jmeno: "  Jan   Novák ", pocet: "2", web: "" });
  assert.deepEqual(ok.data, { jmeno: "Jan Novák", pocet: 2, web: "" });

  const hlaska = (telo: unknown) => RezervacePostSchema.safeParse(telo).error?.issues[0].message;
  assert.equal(hlaska(null), "Neplatný požadavek.");
  assert.equal(hlaska({ jmeno: "Jan Novák", pocet: 2, web: "spam" }), "Neplatný požadavek.");
  // past na roboty má přednost i před špatným jménem
  assert.equal(hlaska({ jmeno: "", pocet: 2, web: "spam" }), "Neplatný požadavek.");
  assert.equal(hlaska({ jmeno: "Jo", pocet: 2 }), "Vyplňte prosím jméno a příjmení.");
  assert.equal(hlaska({ pocet: 2 }), "Vyplňte prosím jméno a příjmení.");
  assert.equal(hlaska({ jmeno: "Jan Novák", pocet: 11 }), "Zadejte počet osob od 1 do 10.");
  assert.equal(hlaska({ jmeno: "Jan Novák", pocet: 1.5 }), "Zadejte počet osob od 1 do 10.");
  assert.equal(hlaska({ jmeno: "Jan Novák" }), "Zadejte počet osob od 1 do 10.");
});

test("AdminDalSchema pustí jen cestu na tomhle webu", () => {
  for (const ok of ["/oznameni", "/navrh/menu/v1", "/admin", "/navrh?x=1"]) {
    assert.equal(AdminDalSchema.safeParse(ok).success, true, ok);
  }
  for (const spatne of [
    "//zly.cz",
    String.raw`/\zly.cz`,
    "https://zly.cz",
    "oznameni",
    "",
    undefined,
  ]) {
    assert.equal(AdminDalSchema.safeParse(spatne).success, false, String(spatne));
  }
});
