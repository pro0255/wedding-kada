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
import { HUSKY, KYTICE, PRSTEN, SRDCE, TCHYNE, kresli, sirka, vyska } from "./sprity";

/* Pluto (husky) běhá po zemi, shora padají věci. Prstýnek +1, kytice +5,
   tchýně bere život. Bez tří životů je konec. */

const PES_W = sirka(HUSKY[0]);
const PES_H = vyska(HUSKY[0]);
const PES_RYCHLOST = 420; // px/s při klávesách
const ZIVOTY = 3;
const OKRAJ_DOLE = 24;

type Druh = "prsten" | "kytice" | "tchyne";
const DRUHY: { druh: Druh; sprite: string[]; vaha: number; body: number }[] = [
  { druh: "prsten", sprite: PRSTEN, vaha: 6, body: 1 },
  { druh: "kytice", sprite: KYTICE, vaha: 2, body: 5 },
  { druh: "tchyne", sprite: TCHYNE, vaha: 2, body: 0 },
];
const spriteDruhu = (d: Druh) => DRUHY.find((x) => x.druh === d)!.sprite;

function vyberDruh(): Druh {
  const soucet = DRUHY.reduce((a, d) => a + d.vaha, 0);
  let r = Math.random() * soucet;
  for (const d of DRUHY) {
    r -= d.vaha;
    if (r <= 0) return d.druh;
  }
  return "prsten";
}

type Pad = { x: number; y: number; druh: Druh; vy: number };
type Stav = Rozmer & {
  zem: number;
  x: number;
  cil: number | null;
  smer: -1 | 0 | 1;
  otoceny: boolean; // pes běží doprava (sprite je kreslený hlavou vlevo)
  pady: Pad[];
  dalsi: number;
  cas: number;
  body: number;
  zivoty: number;
  konec: boolean;
  zasah: number; // zbývající čas blikání po tchýni
  srdce: Srdce[];
  zvuky: Zvuk[];
};

export const husky: Hra<Stav> = {
  slug: "husky",
  nazev: "Pluto chytá prstýnky",
  popis: "Prstýnek +1, kytice +5, tchýně bere život. Máš tři.",
  napoveda: { mys: "šipky ← → nebo tažení myší", dotyk: "táhni prstem po plátně" },
  jednotka: "bodů",
  start: (r) => ({
    ...r,
    zem: r.H - OKRAJ_DOLE,
    x: r.W / 2 - PES_W / 2,
    cil: null,
    smer: 0,
    otoceny: false,
    pady: [],
    dalsi: 0.6,
    cas: 0,
    body: 0,
    zivoty: ZIVOTY,
    konec: false,
    zasah: 0,
    srdce: novaSrdce(r, 4),
    zvuky: [],
  }),
  vstup(s, v: Vstup) {
    if (v.typ === "pohyb") s.cil = v.x - PES_W / 2;
    else if (v.typ === "klavesa") {
      s.smer = v.smer;
      s.cil = null;
    }
  },
  krok(s, dt): Krok {
    s.cas += dt;
    if (s.zasah > 0) s.zasah -= dt;
    const predX = s.x;
    if (s.cil !== null) {
      s.x += (s.cil - s.x) * Math.min(1, dt * 14); // pes „dobíhá“ prst, ne skokem
    } else if (s.smer !== 0) {
      s.x += s.smer * PES_RYCHLOST * dt;
    }
    s.x = Math.max(0, Math.min(s.W - PES_W, s.x));
    if (Math.abs(s.x - predX) > 0.5) s.otoceny = s.x > predX;
    posunSrdce(s.srdce, s, dt);

    // pád trvá stejně dlouho na výšku i na šířku — rychlost roste s výškou plátna
    const tempo = 1 + s.cas / 40;
    const vyskovyFaktor = s.H / 320;
    s.dalsi -= dt;
    if (s.dalsi <= 0) {
      const druh = vyberDruh();
      const sp = spriteDruhu(druh);
      s.pady.push({
        x: 10 + Math.random() * (s.W - 20 - sirka(sp)),
        y: -vyska(sp),
        druh,
        vy: (140 + Math.random() * 80) * tempo * vyskovyFaktor,
      });
      s.dalsi = (0.9 + Math.random() * 0.5) / tempo;
    }
    const px1 = s.x + 6;
    const px2 = s.x + PES_W - 6;
    const py1 = s.zem - PES_H;
    for (const p of s.pady) {
      p.y += p.vy * dt;
      const sp = spriteDruhu(p.druh);
      const spodek = p.y + vyska(sp);
      const chyceno = spodek >= py1 && spodek <= s.zem + 6 && p.x + sirka(sp) > px1 && p.x < px2;
      if (!chyceno) continue;
      if (p.druh === "tchyne") {
        s.zivoty -= 1;
        s.zasah = 0.8;
        s.zvuky.push("zasah");
        if (s.zivoty <= 0) {
          s.konec = true;
          s.zvuky.push("konec");
        }
      } else {
        s.body += DRUHY.find((d) => d.druh === p.druh)!.body;
        s.zvuky.push(p.druh === "kytice" ? "bonus" : "bod");
      }
      p.y = s.H + 100; // označit ke smazání
    }
    s.pady = s.pady.filter((p) => p.y < s.H + 50);
    const zvuky = s.zvuky;
    s.zvuky = [];
    return { skore: s.body, konec: s.konec, zvuky };
  },
  vykresli(ctx, s, b: Barvy, cas, bezi) {
    ctx.fillStyle = b.pozadi;
    ctx.fillRect(0, 0, s.W, s.H);
    ctx.globalAlpha = 0.28;
    for (const h of s.srdce) kresli(ctx, SRDCE, h.x, h.y, b.zlata, b.zlata, 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = b.ink;
    ctx.fillRect(0, s.zem, s.W, 2);
    for (const p of s.pady) kresli(ctx, spriteDruhu(p.druh), p.x, p.y, b.ink, b.zlata);
    for (let i = 0; i < ZIVOTY; i++) {
      const c = i < s.zivoty ? b.zlata : b.inkJemny;
      kresli(ctx, SRDCE, 10 + i * 24, 12, c, c, 2);
    }
    const snimek = bezi ? Math.floor(cas * 8) % 2 : 0;
    if (s.zasah > 0 && Math.floor(cas * 12) % 2 === 1) return; // blikání po zásahu
    if (s.otoceny) {
      ctx.save();
      ctx.translate(Math.round(s.x) * 2 + PES_W, 0);
      ctx.scale(-1, 1);
      kresli(ctx, HUSKY[snimek], s.x, s.zem - PES_H, b.ink, b.zlata);
      ctx.restore();
    } else {
      kresli(ctx, HUSKY[snimek], s.x, s.zem - PES_H, b.ink, b.zlata);
    }
  },
};
