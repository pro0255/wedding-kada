import { test } from "node:test";
import assert from "node:assert/strict";
import { HraSchema, JmenoSchema, SkorePostSchema, SkoreSchema } from "./schemata.ts";

test("SkoreSchema bere jen celá čísla 0–100000", () => {
  assert.equal(SkoreSchema.safeParse(12).success, true);
  assert.equal(SkoreSchema.safeParse(0).success, true);
  assert.equal(SkoreSchema.safeParse(12.5).success, false);
  assert.equal(SkoreSchema.safeParse(-1).success, false);
  assert.equal(SkoreSchema.safeParse(100001).success, false);
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
