import { novaSrdce, posunSrdce, type Barvy, type Hra, type Krok, type Rozmer, type Srdce, type Vstup, type Zvuk } from "./typy";
import { PRSTEN, SRDCE, kresli, sirka, vyska } from "./sprity";

/* Jeden prsten letí mezi dvojicemi svíček. Tap = mávnutí. Prošlá dvojice = bod. */

const GRAVITACE = 1300;
const MAVNUTI = -380;
const RYCHLOST = 170;
const MEZERA = 118;
const SVICKA_W = 30;
const ROZESTUP = 240;
const PODLAHA = 8;
const PRSTEN_W = sirka(PRSTEN);
const PRSTEN_H = vyska(PRSTEN);

type Svicky = { x: number; mezeraY: number; pocitano: boolean };
type Stav = Rozmer & {
  prstenX: number;
  y: number;
  vy: number;
  svicky: Svicky[];
  body: number;
  konec: boolean;
  srdce: Srdce[];
  zvuky: Zvuk[];
};

function novaSvicka(r: Rozmer, x: number): Svicky {
  return { x, mezeraY: 60 + Math.random() * Math.max(20, r.H - 120 - MEZERA), pocitano: false };
}

export const prsten: Hra<Stav> = {
  slug: "prsten",
  nazev: "Flappy prsten",
  popis: "Proleť Jedním prstenem mezi svíčkami. Každá dvojice je bod.",
  napoveda: { mys: "mezerník nebo klik = mávnutí", dotyk: "klepnutí = mávnutí" },
  jednotka: "svíček",
  start: (r) => ({
    ...r,
    prstenX: Math.round(Math.min(150, r.W * 0.25)),
    y: r.H / 2,
    vy: 0,
    body: 0,
    konec: false,
    svicky: [novaSvicka(r, r.W + 100), novaSvicka(r, r.W + 100 + ROZESTUP)],
    srdce: novaSrdce(r, 4),
    zvuky: [],
  }),
  vstup(s, v: Vstup) {
    if (v.typ === "tap") {
      s.vy = MAVNUTI;
      s.zvuky.push("skok");
    }
  },
  krok(s, dt): Krok {
    s.vy += GRAVITACE * dt;
    s.y += s.vy * dt;
    posunSrdce(s.srdce, s, dt);
    for (const sv of s.svicky) sv.x -= RYCHLOST * dt;
    if (s.svicky[0].x < -SVICKA_W) {
      s.svicky.shift();
      s.svicky.push(novaSvicka(s, s.svicky[s.svicky.length - 1].x + ROZESTUP));
    }
    const x1 = s.prstenX + 3;
    const x2 = s.prstenX + PRSTEN_W - 3;
    const y1 = s.y + 3;
    const y2 = s.y + PRSTEN_H - 3;
    let narazil = y2 >= s.H - PODLAHA || y1 <= 0;
    for (const sv of s.svicky) {
      const vX = x2 > sv.x && x1 < sv.x + SVICKA_W;
      if (vX && (y1 < sv.mezeraY || y2 > sv.mezeraY + MEZERA)) narazil = true;
      if (!sv.pocitano && sv.x + SVICKA_W < x1) {
        sv.pocitano = true;
        s.body += 1;
        s.zvuky.push("bod");
      }
    }
    if (narazil && !s.konec) {
      s.konec = true;
      s.zvuky.push("konec");
    }
    const zvuky = s.zvuky;
    s.zvuky = [];
    return { skore: s.body, konec: s.konec, zvuky };
  },
  vykresli(ctx, s, b: Barvy, cas) {
    ctx.fillStyle = b.pozadi;
    ctx.fillRect(0, 0, s.W, s.H);
    ctx.globalAlpha = 0.28;
    for (const h of s.srdce) kresli(ctx, SRDCE, h.x, h.y, b.zlata, b.zlata, 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = b.ink;
    ctx.fillRect(0, s.H - PODLAHA, s.W, PODLAHA);
    for (const sv of s.svicky) {
      const x = Math.round(sv.x);
      // horní svíčka visí, dolní stojí — plamínek zlatý a mihotá
      ctx.fillStyle = b.ink;
      ctx.fillRect(x, 0, SVICKA_W, sv.mezeraY - 14);
      ctx.fillRect(x, sv.mezeraY + MEZERA + 14, SVICKA_W, s.H - PODLAHA - (sv.mezeraY + MEZERA + 14));
      ctx.fillStyle = b.zlata;
      const plamen = 6 + Math.round(Math.sin(cas * 14 + x) * 2);
      ctx.fillRect(x + SVICKA_W / 2 - 3, sv.mezeraY - 14, 6, plamen);
      ctx.fillRect(x + SVICKA_W / 2 - 3, sv.mezeraY + MEZERA + 14 - plamen, 6, plamen);
    }
    kresli(ctx, PRSTEN, s.prstenX, s.y, b.ink, b.zlata);
  },
};
