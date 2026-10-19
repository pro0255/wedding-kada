import { ALERGENY, DETI, DOSPELI, UVOD } from "../obsah";

/* Kreslení textur pro 3D knihu do <canvas>.

   Strany menu se sázejí stejně jako DOM verze v papir.module.css — velikosti
   jsou v setinách šířky strany (jako cqi), takže poměry sedí. Písma se berou
   z CSS proměnných --serif/--sans: next/font jim dává interní jména rodin
   a canvas je musí znát přesně, jinak by tiše spadl na Georgii. Před kreslením
   se proto čeká, až se načtou i české znaky (latin-ext má vlastní soubor). */

export type Pisma = { serif: string; sans: string };

export const PAPIR = "#fdfbf7";
export const OBALKA = "#fbf8f2";
/* O stupeň tmavší než v DOM (#6b5340, #a8874a): strana je ve scéně
   nasvícená a textura se filtruje, takže by tenké tahy písma zesvětlely. */
const INKOUST = "#5d4633";
const ZLATO = "#977639";
/** Teplá hnědá místo černé — na krémovém stole by černý stín zšedl. */
const STIN = "rgb(70, 50, 32)";
const DIAKRITIKA = "ěščřžýáíéůúťďňó ĚŠČŘŽÝÁÍÉŮÚŤĎŇÓ & · — Menu";

export async function nactiPisma(): Promise<Pisma> {
  const zkouska = document.createElement("span");
  zkouska.style.cssText = "position:absolute;visibility:hidden;font-family:var(--serif)";
  document.body.appendChild(zkouska);
  const serif = getComputedStyle(zkouska).fontFamily;
  zkouska.style.fontFamily = "var(--sans)";
  const sans = getComputedStyle(zkouska).fontFamily;
  zkouska.remove();
  const nacti = (font: string) => document.fonts.load(font, DIAKRITIKA).catch(() => []);
  await Promise.all([
    nacti(`500 40px ${serif}`),
    nacti(`italic 400 40px ${serif}`),
    nacti(`400 40px ${sans}`),
    nacti(`300 40px ${sans}`),
  ]);
  return { serif: `${serif}, Georgia, serif`, sans: `${sans}, "Helvetica Neue", sans-serif` };
}

/* ---------- jednoduchá sazba: řádky pod sebou, svisle na střed ---------- */

type Radek = { pred: number; vyska: number; kresli: (ctx: CanvasRenderingContext2D, y: number) => void };

function zalom(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const radky: string[] = [];
  let radek = "";
  for (const slovo of text.split(" ")) {
    const zkus = radek ? radek + " " + slovo : slovo;
    if (radek && ctx.measureText(zkus).width > max) {
      radky.push(radek);
      radek = slovo;
    } else radek = zkus;
  }
  if (radek) radky.push(radek);
  return radky;
}

/** Šířka textu s prostrkáním (canvas letterSpacing neumí všude, kreslí se po písmenu). */
function sirkaProstrkana(ctx: CanvasRenderingContext2D, text: string, tr: number) {
  let w = 0;
  for (const z of text) w += ctx.measureText(z).width + tr;
  return w - tr;
}

function kresliProstrkane(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tr: number) {
  for (const z of text) {
    ctx.fillText(z, x, y);
    x += ctx.measureText(z).width + tr;
  }
}

type StylTextu = {
  font: string;
  px: number;
  lh: number;
  barva: string;
  tracking?: number;
  max?: number;
  pred?: number;
  velka?: boolean;
};

class Sazba {
  radky: Radek[] = [];
  constructor(private ctx: CanvasRenderingContext2D, private stred: number) {}

  text(text: string, o: StylTextu) {
    const ctx = this.ctx;
    const t = o.velka ? text.toLocaleUpperCase("cs") : text;
    ctx.font = o.font;
    const tr = (o.tracking ?? 0) * o.px;
    const radky = o.max && !tr ? zalom(ctx, t, o.max) : [t];
    const m = ctx.measureText("ĚÁg");
    const asc = m.fontBoundingBoxAscent || o.px * 0.92;
    const desc = m.fontBoundingBoxDescent || o.px * 0.28;
    const lh = o.px * o.lh;
    radky.forEach((r, i) => {
      this.radky.push({
        pred: i === 0 ? (o.pred ?? 0) : 0,
        vyska: lh,
        kresli: (c, y) => {
          c.font = o.font;
          c.fillStyle = o.barva;
          // Jako CSS: polovina prokladu nad obsahem písma, účaří pod ním.
          const ucari = y + (lh - (asc + desc)) / 2 + asc;
          if (tr) {
            const w = sirkaProstrkana(c, r, tr);
            kresliProstrkane(c, r, this.stred - w / 2, ucari, tr);
          } else {
            c.textAlign = "center";
            c.fillText(r, this.stred, ucari);
            c.textAlign = "left";
          }
        },
      });
    });
    return this;
  }

  ornament(sirka: number, pred: number, po: number, barva: string) {
    const k = sirka / 120;
    this.radky.push({
      pred,
      vyska: 12 * k + po,
      kresli: (c, y) => kresliOrnament(c, this.stred - sirka / 2, y, k, barva),
    });
    return this;
  }

  linka(sirka: number, pred: number, barva: string, tloustka: number) {
    this.radky.push({
      pred,
      vyska: tloustka,
      kresli: (c, y) => {
        c.fillStyle = barva;
        c.fillRect(this.stred - sirka / 2, y, sirka, tloustka);
      },
    });
    return this;
  }

  mezera(h: number) {
    this.radky.push({ pred: 0, vyska: h, kresli: () => {} });
    return this;
  }

  get vyska() {
    return this.radky.reduce((a, r) => a + r.pred + r.vyska, 0);
  }

  vykresli(y: number) {
    for (const r of this.radky) {
      y += r.pred;
      r.kresli(this.ctx, y);
      y += r.vyska;
    }
  }
}

/** Zlatá ozdoba z obsah.tsx (viewBox 120 × 12): dvě linky a kosočtverec. */
function kresliOrnament(c: CanvasRenderingContext2D, x: number, y: number, k: number, barva: string) {
  c.save();
  c.translate(x, y);
  c.scale(k, k);
  c.strokeStyle = barva;
  c.fillStyle = barva;
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(0, 6);
  c.lineTo(50, 6);
  c.moveTo(70, 6);
  c.lineTo(120, 6);
  c.stroke();
  c.beginPath();
  c.moveTo(60, 1);
  c.lineTo(65, 6);
  c.lineTo(60, 11);
  c.lineTo(55, 6);
  c.closePath();
  c.fill();
  c.restore();
}

/* ---------- strany menu ---------- */

export function kresliStranu(druh: "dospeli" | "deti", p: Pisma, sirkaPx: number, pomer: number) {
  // Dospělí jsou na rubu desky (hřbet vpravo), děti na bloku (hřbet vlevo).
  const hrbetVlevo = druh === "deti";
  const cv = document.createElement("canvas");
  cv.width = sirkaPx;
  cv.height = Math.round(sirkaPx * pomer);
  const ctx = cv.getContext("2d")!;
  const c = sirkaPx / 100;

  ctx.fillStyle = PAPIR;
  ctx.fillRect(0, 0, cv.width, cv.height);
  // Stín u hřbetu: papír se tam stáčí do vazby.
  const sire = 9 * c;
  const g = hrbetVlevo
    ? ctx.createLinearGradient(0, 0, sire, 0)
    : ctx.createLinearGradient(cv.width, 0, cv.width - sire, 0);
  g.addColorStop(0, "rgba(80, 62, 44, .16)");
  g.addColorStop(0.35, "rgba(80, 62, 44, .05)");
  g.addColorStop(1, "rgba(80, 62, 44, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(hrbetVlevo ? 0 : cv.width - sire, 0, sire, cv.height);
  // Vlasová zlatá linka kousek od kraje, jako na tištěné kartě.
  const okraj = 3.2 * c;
  ctx.strokeStyle = "rgba(168, 135, 74, .6)";
  ctx.lineWidth = Math.max(1.5, c * 0.24);
  ctx.strokeRect(okraj, okraj, cv.width - 2 * okraj, cv.height - 2 * okraj);

  const serif = (styl: string, px: number) => `${styl} ${px}px ${p.serif}`;
  const sans = (styl: string, px: number) => `${styl} ${px}px ${p.sans}`;
  const obsah = cv.width - 18 * c;
  const s = new Sazba(ctx, cv.width / 2);

  const nadpis = druh === "dospeli" ? "Menu" : "Pro naše nejmenší";
  s.text(nadpis, { font: serif("500", 4.6 * c), px: 4.6 * c, lh: 1.7, barva: INKOUST, tracking: 0.28, velka: true });
  s.ornament(30 * c, 3 * c, 5 * c, ZLATO);
  if (druh === "dospeli") {
    s.text(UVOD, { font: serif("italic 400", 3.7 * c), px: 3.7 * c, lh: 1.5, barva: INKOUST, max: obsah * 0.86, pred: -1 * c });
    s.mezera(5.5 * c);
  }
  (druh === "dospeli" ? DOSPELI : DETI).forEach((ch, i) => {
    s.text(ch.kurz, {
      font: sans("400", 2.6 * c), px: 2.6 * c, lh: 1.7, barva: ZLATO, tracking: 0.32, velka: true, pred: i ? 5 * c : 0,
    });
    s.mezera(1.2 * c);
    s.text(ch.jidlo, { font: serif("500", 5.1 * c), px: 5.1 * c, lh: 1.2, barva: INKOUST, max: obsah });
    s.text(ch.detail, { font: serif("italic 400", 3.7 * c), px: 3.7 * c, lh: 1.35, barva: INKOUST, max: obsah, pred: 1.2 * c });
  });
  if (druh === "dospeli") {
    s.text(ALERGENY, { font: sans("300", 2.9 * c), px: 2.9 * c, lh: 1.55, barva: INKOUST, max: obsah * 0.9, pred: 6 * c });
  } else {
    ctx.font = serif("500", 3.6 * c);
    const tr = 0.28 * 3.6 * c;
    const sirka = sirkaProstrkana(ctx, "DOBROU CHUŤ", tr) + tr;
    s.linka(sirka, 6 * c, "rgba(168, 135, 74, .45)", Math.max(1.5, c * 0.22));
    s.text("Dobrou chuť", { font: serif("500", 3.6 * c), px: 3.6 * c, lh: 1.7, barva: INKOUST, tracking: 0.28, velka: true, pred: 4 * c });
  }
  s.vykresli(Math.max(9 * c, (cv.height - s.vyska) / 2));
  return cv;
}

/* ---------- líc desek: papír + zlatá ražba ----------
   Tři plátna se stejnou kresbou: barva, „ORM“ (zelená = drsnost, modrá =
   kovovost — tak je čte MeshStandardMaterial) a reliéf. Ražba je tedy
   opravdový kov: odráží okolí a blýskne se, když deska projde světlem. */

type Vrstva = { pozadi: string; folie: string; rozmaz?: number };

function kresliRazbu(ctx: CanvasRenderingContext2D, p: Pisma, w: number, h: number, v: Vrstva) {
  const c = w / 100;
  ctx.fillStyle = v.pozadi;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = v.folie;
  ctx.strokeStyle = v.folie;
  if (v.rozmaz) ctx.filter = `blur(${v.rozmaz}px)`;

  // dvojitý rámeček
  const r1 = 5.5 * c;
  ctx.lineWidth = Math.max(1.5, 0.36 * c);
  ctx.strokeRect(r1, r1, w - 2 * r1, h - 2 * r1);
  const r2 = r1 + 1.25 * c;
  ctx.lineWidth = Math.max(1, 0.2 * c);
  ctx.strokeRect(r2, r2, w - 2 * r2, h - 2 * r2);

  const serif = (styl: string, px: number) => `${styl} ${px}px ${p.serif}`;
  const sans = (styl: string, px: number) => `${styl} ${px}px ${p.sans}`;
  const s = new Sazba(ctx, w / 2);
  s.text("Menu", { font: serif("500", 15 * c), px: 15 * c, lh: 1, barva: v.folie, tracking: 0.26, velka: true });
  s.ornament(30 * c, 3 * c, 5 * c, v.folie);
  s.text("K & J", { font: serif("italic 400", 9 * c), px: 9 * c, lh: 1.7, barva: v.folie, tracking: 0.08 });
  s.text("18 · 09 · 2027", { font: sans("400", 3.2 * c), px: 3.2 * c, lh: 1.7, barva: v.folie, tracking: 0.4, pred: 4 * c });
  s.vykresli((h - s.vyska) / 2);
  ctx.filter = "none";
}

export function kresliObalku(p: Pisma, sirkaPx: number, pomer: number) {
  const plátno = (k: number) => {
    const cv = document.createElement("canvas");
    cv.width = Math.round(sirkaPx * k);
    cv.height = Math.round(sirkaPx * k * pomer);
    return cv;
  };
  const barva = plátno(1);
  kresliRazbu(barva.getContext("2d")!, p, barva.width, barva.height, { pozadi: OBALKA, folie: "#d8b26e" });
  // drsnost papíru 0,8 (zelená 204), ražba 0,3 (77) a plný kov (modrá 255)
  const orm = plátno(0.5);
  kresliRazbu(orm.getContext("2d")!, p, orm.width, orm.height, { pozadi: "rgb(0,204,0)", folie: "rgb(0,77,255)" });
  // reliéf: papír nahoře, ražba vtlačená o kus níž, s měkkou hranou
  const relief = plátno(0.5);
  kresliRazbu(relief.getContext("2d")!, p, relief.width, relief.height, { pozadi: "#fff", folie: "#8a8a8a", rozmaz: 0.8 });
  return { barva, orm, relief };
}

/* ---------- ořízka bloku: listy papíru naskládané na sebe ---------- */
export function kresliOrizku() {
  const cv = document.createElement("canvas");
  cv.width = 8;
  cv.height = 128;
  const ctx = cv.getContext("2d")!;
  for (let y = 0; y < cv.height; y++) {
    const list = y % 4 < 3;
    const odstin = list ? 246 + ((y * 7) % 5) : 226;
    ctx.fillStyle = `rgb(${odstin}, ${odstin - 4}, ${odstin - 12})`;
    ctx.fillRect(0, y, cv.width, 1);
  }
  return cv;
}

/* ---------- měkké stíny ---------- */

/** Rozmazaný obdélník — kontaktní stín pod deskami. */
export function kresliSkvrnu() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 256;
  const ctx = cv.getContext("2d")!;
  // Stín bez tvaru: obdélník se nakreslí mimo plátno a dovnitř padne jen
  // jeho rozmazaný stín (shadowBlur umí každý prohlížeč, filtr na plátně ne).
  ctx.shadowColor = STIN;
  ctx.shadowBlur = 22;
  ctx.shadowOffsetX = 2000;
  ctx.fillStyle = STIN;
  ctx.beginPath();
  ctx.roundRect(40 - 2000, 40, 176, 176, 10);
  ctx.fill();
  return cv;
}

/** Stín květiny: její silueta, rozmazaná. Sedí pod ní, kousek po světle. */
export function kresliStinKvetu(obr: CanvasImageSource & { width: number; height: number }, sirka = 160) {
  const pomer = obr.height / obr.width;
  const okraj = Math.round(sirka * 0.12);
  const cv = document.createElement("canvas");
  cv.width = sirka + 2 * okraj;
  cv.height = Math.round(sirka * pomer) + 2 * okraj;
  const ctx = cv.getContext("2d")!;
  ctx.shadowColor = STIN;
  ctx.shadowBlur = sirka * 0.06;
  ctx.shadowOffsetX = 5000;
  ctx.drawImage(obr, okraj - 5000, okraj, sirka, sirka * pomer);
  return { platno: cv, presah: cv.width / sirka };
}
