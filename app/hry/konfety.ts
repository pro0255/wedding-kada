import { PRSTEN, SRDCE, kresli } from "./hry/sprity";
import type { Rozmer } from "./hry/typy";

/* Konfety při novém rekordu: pixelová srdíčka a prstýnky prší z vrchu
   plátna zhruba dvě sekundy. Kreslí se až přes hru, nezasahují do stavu. */

type Kus = { x: number; y: number; vx: number; vy: number; rot: number; prsten: boolean; m: number };

export class Konfety {
  private kusy: Kus[] = [];
  private zbyva = 0;

  spust(r: Rozmer) {
    this.zbyva = 2.4;
    this.kusy = Array.from({ length: 70 }, () => ({
      x: Math.random() * r.W,
      y: -20 - Math.random() * r.H * 0.6,
      vx: (Math.random() - 0.5) * 80,
      vy: 120 + Math.random() * 160,
      rot: Math.random() * 6,
      prsten: Math.random() < 0.3,
      m: 2 + Math.floor(Math.random() * 2),
    }));
  }

  get aktivni() {
    return this.zbyva > 0;
  }

  krok(dt: number, r: Rozmer) {
    if (this.zbyva <= 0) return;
    this.zbyva -= dt;
    for (const k of this.kusy) {
      k.x += k.vx * dt + Math.sin(k.rot + k.y / 40) * 30 * dt;
      k.y += k.vy * dt;
      if (k.y > r.H + 20) k.y = -20;
    }
  }

  vykresli(ctx: CanvasRenderingContext2D, ink: string, zlata: string) {
    if (this.zbyva <= 0) return;
    ctx.globalAlpha = Math.min(1, this.zbyva / 0.6);
    for (const k of this.kusy) {
      kresli(ctx, k.prsten ? PRSTEN : SRDCE, k.x, k.y, zlata, zlata, k.m);
    }
    ctx.globalAlpha = 1;
    void ink;
  }
}
