import {
  novaSrdce,
  posunSrdce,
  type Barvy,
  type Hra,
  type Krok,
  type Rozmer,
  type Srdce,
  type Vstup,
  type Zvuk,
} from "./typy";
import { DORT, HUSKY, KYTICE, SRDCE, TCHYNE, ZENICH_BEH, ZENICH_SKOK, kresli, sirka, vyska } from "./sprity";

/* Dino klon: ženich běží k oltáři a skáče přes dort, Pluta, kytici a tchýni. */

const GRAVITACE = 1500;
const SKOK = -620;
const RYCHLOST_START = 300;
const RYCHLOST_MAX = 680;
const OKRAJ_DOLE = 32; // pod čárou země

/* Překážky: sprite(y), přiblížení hitboxu (px), ať skok odpouští. */
const PREKAZKY = [
  { snimky: [DORT], odsazeni: 4 },
  { snimky: HUSKY, odsazeni: 6 },
  { snimky: [KYTICE], odsazeni: 4 },
  { snimky: [TCHYNE], odsazeni: 5 },
];
const ZENICH_W = sirka(ZENICH_BEH[0]);
const ZENICH_H = vyska(ZENICH_BEH[0]);

type Stav = Rozmer & {
  zem: number;
  zenichX: number;
  y: number;
  vy: number;
  rychlost: number;
  vzdalenost: number;
  prekazky: { x: number; typ: number }[];
  dalsi: number;
  konec: boolean;
  kamenky: { x: number; w: number }[];
  srdce: Srdce[];
  zvuky: Zvuk[];
};

export const zenich: Hra<Stav> = {
  slug: "zenich",
  nazev: "Ženich běží k oltáři",
  popis: "Skákej přes dort, Pluta, kytici a tchýni. Čím dál doběhneš, tím líp.",
  napoveda: { mys: "mezerník nebo klik = skok", dotyk: "klepnutí = skok" },
  jednotka: "m",
  start: (r) => {
    // na výšku je země zhruba ve dvou třetinách, ať je hra u prstů a ne u brady
    const zem = r.H > r.W ? Math.round(r.H * 0.62) : r.H - OKRAJ_DOLE;
    return {
      ...r,
      zem,
      zenichX: Math.round(Math.min(56, r.W * 0.12)),
      y: zem,
      vy: 0,
      rychlost: RYCHLOST_START,
      vzdalenost: 0,
      prekazky: [],
      dalsi: r.W + 200,
      konec: false,
      kamenky: Array.from({ length: 14 }, () => ({
        x: Math.random() * r.W,
        w: 3 + Math.round(Math.random() * 6),
      })),
      srdce: novaSrdce(r, 5),
      zvuky: [],
    };
  },
  vstup(s, v: Vstup) {
    if (v.typ === "tap" && s.y >= s.zem) {
      s.vy = SKOK;
      s.zvuky.push("skok");
    }
  },
  krok(s, dt): Krok {
    s.rychlost = Math.min(RYCHLOST_MAX, s.rychlost + 9 * dt);
    const posun = s.rychlost * dt;
    const predtim = Math.floor(s.vzdalenost / 100);
    s.vzdalenost += posun;
    if (Math.floor(s.vzdalenost / 100) > predtim) s.zvuky.push("bod"); // každých 10 m cinknutí

    s.vy += GRAVITACE * dt;
    s.y += s.vy * dt;
    if (s.y > s.zem) {
      s.y = s.zem;
      s.vy = 0;
    }
    for (const k of s.kamenky) {
      k.x -= posun;
      if (k.x < -10) k.x = s.W + Math.random() * 40;
    }
    posunSrdce(s.srdce, s, dt);
    s.dalsi -= posun;
    if (s.dalsi <= 0) {
      s.prekazky.push({ x: s.W + 10, typ: Math.floor(Math.random() * PREKAZKY.length) });
      // mezera roste s rychlostí — skok je vždy stihnutelný
      s.dalsi = s.rychlost * 0.85 + 120 + Math.random() * 320;
    }
    for (const p of s.prekazky) p.x -= posun;
    s.prekazky = s.prekazky.filter((p) => p.x > -120);

    const zx1 = s.zenichX + 8;
    const zx2 = s.zenichX + ZENICH_W - 8;
    const zy1 = s.y - ZENICH_H + 6;
    const zy2 = s.y - 2;
    for (const p of s.prekazky) {
      const def = PREKAZKY[p.typ];
      const sp = def.snimky[0];
      const o = def.odsazeni;
      if (zx1 < p.x + sirka(sp) - o && zx2 > p.x + o && zy1 < s.zem && zy2 > s.zem - vyska(sp) + o) {
        s.konec = true;
        s.zvuky.push("konec");
        break;
      }
    }
    const zvuky = s.zvuky;
    s.zvuky = [];
    return { skore: Math.floor(s.vzdalenost / 10), konec: s.konec, zvuky };
  },
  vykresli(ctx, s, b: Barvy, cas, bezi) {
    ctx.fillStyle = b.pozadi;
    ctx.fillRect(0, 0, s.W, s.H);
    ctx.globalAlpha = 0.28;
    for (const h of s.srdce) kresli(ctx, SRDCE, h.x, h.y, b.zlata, b.zlata, 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = b.ink;
    ctx.fillRect(0, s.zem, s.W, 2);
    ctx.fillStyle = b.inkJemny;
    for (const k of s.kamenky) ctx.fillRect(Math.round(k.x), s.zem + 8, k.w, 2);
    const snimek = Math.floor(cas * 8) % 2;
    for (const p of s.prekazky) {
      const def = PREKAZKY[p.typ];
      const sp = def.snimky[snimek % def.snimky.length];
      kresli(ctx, sp, p.x, s.zem - vyska(sp), b.ink, b.zlata);
    }
    const sp = s.konec ? ZENICH_BEH[0] : s.y < s.zem || !bezi ? ZENICH_SKOK : ZENICH_BEH[snimek];
    kresli(ctx, sp, s.zenichX, s.y - ZENICH_H, b.ink, b.zlata);
  },
};
