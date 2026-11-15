/**
 * Minimální ZIP bez komprese (metoda STORE) — na stažení všech fotek
 * z /admin. Cloudinary na free účtu ZIP archivy blokuje a přes server
 * by se nevešly (Vercel pustí odpověď max 4,5 MB), takže se zip skládá
 * v prohlížeči. JPEG a video jsou už zkomprimované, STORE je tu nejlepší
 * volba: rychlé a bez knihovny.
 *
 * Bez ZIP64 — celý archiv musí být pod 4 GB a mít méně než 65 535 souborů.
 * Běží v prohlížeči i v Node (testy), nic z Node nepotřebuje.
 */

const CRC_TABULKA = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABULKA[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export type SouborZipu = { nazev: string; data: Uint8Array; datum?: Date };

const MAX_32 = 0xffffffff;
const UTF8 = 0x08_00; // příznak: jména souborů jsou v UTF-8 (diakritika)

/** Datum a čas ve formátu MS-DOS, jak ho ZIP čeká (po 2 s, od roku 1980). */
function dosCas(d: Date): { cas: number; datum: number } {
  const rok = Math.min(Math.max(d.getFullYear(), 1980), 2107);
  return {
    cas: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    datum: ((rok - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Části archivu v pořadí — pro `new Blob(casti)`, bez kopírování dat fotek. */
export function zabal(soubory: SouborZipu[]): Uint8Array[] {
  if (soubory.length >= 0xffff) throw new Error("Moc souborů na jeden ZIP.");
  const kodovac = new TextEncoder();
  const casti: Uint8Array[] = [];
  const adresar: Uint8Array[] = [];
  let posun = 0;

  for (const s of soubory) {
    const jmeno = kodovac.encode(s.nazev);
    const { cas, datum } = dosCas(s.datum ?? new Date());
    const crc = crc32(s.data);
    const velikost = s.data.length;
    if (posun + 30 + jmeno.length + velikost > MAX_32) throw new Error("ZIP by měl přes 4 GB.");

    const hlava = new Uint8Array(30 + jmeno.length);
    const h = new DataView(hlava.buffer);
    h.setUint32(0, 0x04034b50, true); // local file header
    h.setUint16(4, 20, true); // potřebná verze 2.0
    h.setUint16(6, UTF8, true);
    h.setUint16(8, 0, true); // STORE
    h.setUint16(10, cas, true);
    h.setUint16(12, datum, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, velikost, true);
    h.setUint32(22, velikost, true);
    h.setUint16(26, jmeno.length, true);
    h.setUint16(28, 0, true);
    hlava.set(jmeno, 30);

    const zaznam = new Uint8Array(46 + jmeno.length);
    const z = new DataView(zaznam.buffer);
    z.setUint32(0, 0x02014b50, true); // central directory header
    z.setUint16(4, 20, true);
    z.setUint16(6, 20, true);
    z.setUint16(8, UTF8, true);
    z.setUint16(10, 0, true);
    z.setUint16(12, cas, true);
    z.setUint16(14, datum, true);
    z.setUint32(16, crc, true);
    z.setUint32(20, velikost, true);
    z.setUint32(24, velikost, true);
    z.setUint16(28, jmeno.length, true);
    // 30–41: extra, komentář, disk, atributy — vše nula
    z.setUint32(42, posun, true);
    zaznam.set(jmeno, 46);

    casti.push(hlava, s.data);
    adresar.push(zaznam);
    posun += hlava.length + velikost;
  }

  const velikostAdresare = adresar.reduce((n, a) => n + a.length, 0);
  const konec = new Uint8Array(22);
  const k = new DataView(konec.buffer);
  k.setUint32(0, 0x06054b50, true); // end of central directory
  k.setUint16(8, soubory.length, true);
  k.setUint16(10, soubory.length, true);
  k.setUint32(12, velikostAdresare, true);
  k.setUint32(16, posun, true);

  return [...casti, ...adresar, konec];
}
