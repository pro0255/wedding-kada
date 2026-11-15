import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { crc32 as zlibCrc32 } from "node:zlib";
import { crc32, zabal } from "./zip.ts";

const spoj = (casti: Uint8Array[]) => Buffer.concat(casti.map((c) => Buffer.from(c)));

test("crc32 sedí se zlib", () => {
  for (const data of [
    new Uint8Array(0),
    new TextEncoder().encode("Kačka & Kuba"),
    new Uint8Array(70_000).map((_, i) => i * 7),
  ]) {
    assert.equal(crc32(data), zlibCrc32(data));
  }
});

test("archiv přečte Python zipfile: jména s diakritikou, obsah i datum", () => {
  const soubory = [
    {
      nazev: "001_fotka.jpg",
      data: new Uint8Array(5000).map((_, i) => i % 251),
      datum: new Date(2027, 8, 18, 14, 32, 10),
    },
    {
      nazev: "002_Kačka.txt",
      data: new TextEncoder().encode("ahoj"),
      datum: new Date(2027, 8, 18, 23, 5, 0),
    },
    { nazev: "prazdny.txt", data: new Uint8Array(0) },
  ];
  const slozka = mkdtempSync(path.join(tmpdir(), "zip-test-"));
  try {
    const soubor = path.join(slozka, "test.zip");
    writeFileSync(soubor, spoj(zabal(soubory)));
    // -I: Python bez cizích modulů z aktuální složky
    const vystup = execFileSync(
      "python3",
      [
        "-I",
        "-c",
        `import zipfile,sys,json,hashlib
z=zipfile.ZipFile(sys.argv[1])
assert z.testzip() is None
print(json.dumps([[i.filename,i.file_size,list(i.date_time),hashlib.sha1(z.read(i)).hexdigest()] for i in z.infolist()]))`,
        soubor,
      ],
      { encoding: "utf8" },
    );
    const precteno = JSON.parse(vystup) as [string, number, number[], string][];
    assert.deepEqual(
      precteno.map((p) => p[0]),
      soubory.map((s) => s.nazev),
    );
    assert.deepEqual(
      precteno.map((p) => p[1]),
      soubory.map((s) => s.data.length),
    );
    assert.deepEqual(precteno[0][2], [2027, 9, 18, 14, 32, 10]);
    const sha = (d: Uint8Array) =>
      execFileSync("shasum", { input: d, encoding: "utf8" }).split(" ")[0];
    assert.equal(precteno[1][3], sha(soubory[1].data));
  } finally {
    rmSync(slozka, { recursive: true, force: true });
  }
});
