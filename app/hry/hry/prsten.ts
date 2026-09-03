import type { Barvy, Hra, Krok, Vstup, Zvuk } from "./typy";
import { PRSTEN, SRDCE, kresli, sirka, vyska } from "./sprity";

/* Jeden prsten letí mezi dvojicemi svíček. Tap = mávnutí. Prošlá dvojice = bod. */

const W = 640;
const H = 320;
const GRAVITACE = 1300;
const MAVNUTI = -380;
const RYCHLOST = 170;
const MEZERA = 118;
const SVICKA_W = 30;
const ROZESTUP = 240;
const PRSTEN_W = sirka(PRSTEN);
const PRSTEN_H = vyska(PRSTEN);
const PRSTEN_X = 150;

type Svicky = { x: number; mezeraY: number; pocitano: boolean };
type Stav = {
  y: number;
  vy: number;
  svicky: Svicky[];
  body: number;
  konec: boolean;
  srdce: { x: number; y: number; v: number }[];
  zvuky: Zvuk[];
};

function novaSvicka(x: number): Svicky {
  return { x, mezeraY: 60 + Math.random() * (H - 120 - MEZERA), pocitano: false };
}

export const prsten: Hra<Stav> = {
  slug: "prsten",
  nazev: "Flappy prsten",
  popis: "Proleť Jedním prstenem mezi svíčkami. Každá dvojice je bod.",
  napoveda: { mys: "mezerník nebo klik = mávnutí", dotyk: "klepnutí = mávnutí" },
  jednotka: "svíček",
  W,
  H,
  start: () => ({
    y: H / 2,
    vy: 0,
    body: 0,
    konec: false,
    svicky: [novaSvicka(W + 100), novaSvicka(W + 100 + ROZESTUP)],
    srdce: Array.from({ length: 4 }, (_, i) => ({
      x: (i / 4) * W + Math.random() * 80,
      y: 20 + Math.random() * (H - 60),
      v: 0.5 + Math.random() * 0.5,
    })),
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
    for (const h of s.srdce) {
      h.x -= h.v * 12 * dt;
      if (h.x < -30) {
        h.x = W + 20;
        h.y = 20 + Math.random() * (H - 60);
      }
    }
    for (const sv of s.svicky) sv.x -= RYCHLOST * dt;
    if (s.svicky[0].x < -SVICKA_W) {
      s.svicky.shift();
      s.svicky.push(novaSvicka(s.svicky[s.svicky.length - 1].x + ROZESTUP));
    }
    const x1 = PRSTEN_X + 3;
    const x2 = PRSTEN_X + PRSTEN_W - 3;
    const y1 = s.y + 3;
    const y2 = s.y + PRSTEN_H - 3;
    let narazil = y2 >= H - 8 || y1 <= 0;
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
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.28;
    for (const h of s.srdce) kresli(ctx, SRDCE, h.x, h.y, b.zlata, b.zlata, 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = b.ink;
    ctx.fillRect(0, H - 8, W, 8);
    for (const sv of s.svicky) {
      const x = Math.round(sv.x);
      // horní svíčka visí, dolní stojí — plamínek zlatý a mihotá
      ctx.fillStyle = b.ink;
      ctx.fillRect(x, 0, SVICKA_W, sv.mezeraY - 14);
      ctx.fillRect(x, sv.mezeraY + MEZERA + 14, SVICKA_W, H - 8 - (sv.mezeraY + MEZERA + 14));
      ctx.fillStyle = b.zlata;
      const plamen = 6 + Math.round(Math.sin(cas * 14 + x) * 2);
      ctx.fillRect(x + SVICKA_W / 2 - 3, sv.mezeraY - 14, 6, plamen);
      ctx.fillRect(x + SVICKA_W / 2 - 3, sv.mezeraY + MEZERA + 14 - plamen, 6, plamen);
    }
    kresli(ctx, PRSTEN, PRSTEN_X, s.y, b.ink, b.zlata);
  },
};
