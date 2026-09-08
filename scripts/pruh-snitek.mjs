/* Boční pruh webu poskládaný ze snítek z oznámení.
 *
 *   node scripts/pruh-snitek.mjs
 *
 * Bere tytéž snítky, jaké jsou na tištěném oznámení (vyřezal je
 * scripts/kyticky-oznameni.mjs), a rozsazuje je na béžový podklad do svislého
 * pásu. Web a tiskovina tak mají stejné kytky.
 *
 * Poměr stran musí zůstat 1 : 3,413, protože na něm stojí --kv-tile
 * v globals.css. Svisle se pás nemusí navazovat na pixel — dvě vrstvy posunuté
 * o půl dlaždice a maskované po okrajích šev schovají.
 *
 * Pravidla rozsypu, všechna schválně:
 *
 * - Snítek je málo. Na úzkém pruhu, který se přes celou stránku zopakuje
 *   patnáctkrát, je hustý rozsyp jen skvrna; pár kusů působí mile.
 * - Nesmí ležet na boku ani vzhůru nohama, takže náklon je nanejvýš deset
 *   stupňů.
 * - Nesmí se překrývat ani stát v řadě pod sebou. Místo mřížky, která řady
 *   vyrábí, se pozice losují a kandidát se zahodí, když je moc blízko něčemu
 *   už položenému. Odstup se měří i vodorovně, takže dvě snítky nad sebou
 *   musí být aspoň o kus stranou.
 * - Žádná snítka se neopakuje. Losování hashem samo o sobě klidně vytáhne
 *   tutéž dvakrát po sobě, tak se vede seznam použitých a při shodě se posune
 *   na další volnou. Seznam je společný pro oba pásy, takže se tatáž kytka
 *   neobjeví ani vlevo a vpravo.
 * - Nikdy se nezvětšují. Vyřezané snítky jsou různě velké, od osmdesáti do tří
 *   set pixelů, a zvětšená snítka je rozmazaná — akvarel nemá co dokreslovat.
 *   Do pásu se proto berou jen ty, které mají dost pixelů, a i tak se zmenšují
 *   nanejvýš na svou vlastní velikost.
 *
 * Pásy jsou dva, pro levou a pravou stranu, a každý má jiný rozsyp. Pravá
 * strana je v CSS zrcadlená a svisle posunutá, jenže to z ní pořád dělá tutéž
 * kresbu — na každé výškové úrovni by vlevo i vpravo seděl tentýž květ. Se dvěma
 * pásy se neopakuje nic.
 *
 * Náhoda je sinusový hash z pořadí, ne Math.random: skript musí při každém
 * spuštění vyrobit tentýž pás, jinak by se web po každém buildu tvářil jinak. */

import sharp from "sharp";
import { readdir } from "node:fs/promises";

const ZDROJ = "public/oznameni/kyticky";
const CILE = [
  { cil: "public/fotky/kvetiny-snitky-l.jpg", posun: 0 },
  { cil: "public/fotky/kvetiny-snitky-p.jpg", posun: 500 },
];

const SIRKA = 600;
const VYSKA = 2048;
const PODKLAD = "#ece7de";      // --bg-alt z globals.css

const POCET = 9;
const NEJMENSI = 150;
const NEJVETSI = 225;

/* Nejmenší vzdálenost středů dvou snítek. Drží je od sebe a zároveň brání
 * tomu, aby se seřadily do sloupce. */
const ODSTUP = 300;

/* Kam smí střed snítky padnout, jako podíl šířky pásu. Vpravo pás doznívá do
 * textu, tam už kytka nemá co dělat. */
const OD = 0.1;
const DO = 0.6;

const NAKLON = 10;

const sum = (a, b) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/* Snítky i s jejich skutečnou velikostí — menší než NEJMENSI se do pásu
 * nedostanou, protože by se musely zvětšovat. */
const soubory = [];
for (const f of (await readdir(ZDROJ)).sort()) {
  if (!/^[0-9]+[.]png$/.test(f)) continue;
  const { height } = await sharp(ZDROJ + "/" + f).metadata();
  if (height >= NEJMENSI) soubory.push({ f, height });
}

/* Co už je použité — společné pro oba pásy. */
const pouzite = new Set();

for (const { cil, posun } of CILE) {
const stredy = [];
const vrstvy = [];

for (let i = posun; i < posun + POCET; i++) {
  /* Hash vybere výchozí snítku; když už je použitá, posune se na další volnou. */
  let index = Math.floor(sum(i, 3) * soubory.length) % soubory.length;
  for (let k = 0; k < soubory.length && pouzite.has(soubory[index].f); k++) {
    index = (index + 1) % soubory.length;
  }
  const { f: soubor, height: nativni } = soubory[index];
  pouzite.add(soubor);
  /* Nikdy nahoru: zvětšená snítka je rozmazaná. */
  const vyska = Math.min(nativni, Math.round(NEJMENSI + sum(i, 1) * (NEJVETSI - NEJMENSI)));
  const otoceni = Math.round(-NAKLON + sum(i, 2) * NAKLON * 2);

  const snitka = await sharp(`${ZDROJ}/${soubor}`)
    .resize({ height: vyska })
    .rotate(otoceni, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const { width: w, height: h } = await sharp(snitka).metadata();

  /* Losuje se tak dlouho, dokud kandidát není dost daleko od všech ostatních.
   * Když se to za sto pokusů nepovede, snítka se vynechá — radši o jednu míň
   * než dvě na sobě. */
  let umisteno = false;
  for (let pokus = 0; pokus < 100 && !umisteno; pokus++) {
    const sx = (OD + sum(i * 31 + pokus, 7) * (DO - OD)) * SIRKA;
    const sy = sum(i * 31 + pokus, 11) * VYSKA;
    if (sy - h / 2 < 0 || sy + h / 2 > VYSKA) continue;
    if (stredy.some((s) => Math.hypot(s.x - sx, s.y - sy) < ODSTUP)) continue;

    stredy.push({ x: sx, y: sy });
    vrstvy.push({
      input: snitka,
      left: Math.max(0, Math.min(SIRKA - w, Math.round(sx - w / 2))),
      top: Math.max(0, Math.min(VYSKA - h, Math.round(sy - h / 2))),
    });
    umisteno = true;
  }
}

const info = await sharp({
  create: { width: SIRKA, height: VYSKA, channels: 3, background: PODKLAD },
})
  .composite(vrstvy)
  .jpeg({ quality: 86, chromaSubsampling: "4:4:4" })
  .toFile(cil);

console.log(
  `${cil}  ${info.width} x ${info.height} px, ${(info.size / 1024).toFixed(0)} kB, ` +
    `${vrstvy.length} snítek z ${POCET}, poměr stran ${(VYSKA / SIRKA).toFixed(3)}`,
);
}
