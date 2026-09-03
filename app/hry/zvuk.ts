import type { Zvuk } from "./hry/typy";

/**
 * Zvuky syntetizované Web Audio API — žádné soubory, pár oscilátorů.
 * AudioContext vzniká až po prvním gestu (autoplay pravidla). Ztlumení
 * si pamatujeme v localStorage, ať host nemusí mlčet web pokaždé znovu.
 */
const KLIC = "kj-zvuk";

export class Zvuky {
  private ctx: AudioContext | null = null;
  ztlumeno = false;

  constructor() {
    try {
      this.ztlumeno = localStorage.getItem(KLIC) === "0";
    } catch {}
  }

  prepni(): boolean {
    this.ztlumeno = !this.ztlumeno;
    try {
      localStorage.setItem(KLIC, this.ztlumeno ? "0" : "1");
    } catch {}
    return this.ztlumeno;
  }

  /** Zavolat z gesta uživatele — vytvoří/odemkne kontext. */
  odemkni() {
    if (this.ztlumeno) return;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  prehraj(z: Zvuk) {
    if (this.ztlumeno || !this.ctx) return;
    const t = this.ctx.currentTime;
    switch (z) {
      case "skok":
        this.ton("square", 320, 620, t, 0.11, 0.05);
        break;
      case "bod":
        this.ton("sine", 880, 880, t, 0.07, 0.05);
        break;
      case "bonus":
        this.ton("sine", 660, 660, t, 0.08, 0.06);
        this.ton("sine", 880, 880, t + 0.08, 0.08, 0.06);
        this.ton("sine", 1320, 1320, t + 0.16, 0.12, 0.06);
        break;
      case "zasah":
        this.ton("sawtooth", 180, 90, t, 0.22, 0.07);
        break;
      case "konec":
        this.ton("triangle", 440, 440, t, 0.14, 0.07);
        this.ton("triangle", 330, 330, t + 0.15, 0.14, 0.07);
        this.ton("triangle", 220, 160, t + 0.3, 0.35, 0.07);
        break;
    }
  }

  private ton(
    typ: OscillatorType,
    odHz: number,
    doHz: number,
    start: number,
    delka: number,
    hlasitost: number,
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = typ;
    osc.frequency.setValueAtTime(odHz, start);
    if (doHz !== odHz) osc.frequency.exponentialRampToValueAtTime(doHz, start + delka);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(hlasitost, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + delka);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + delka + 0.02);
  }
}
