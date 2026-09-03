"use client";

import { useEffect, useRef } from "react";
import type { HraSlug } from "@/lib/schemata";
import { HUSKY, PRSTEN, ZENICH_BEH, kresli, type Sprite } from "./hry/sprity";

export const IKONY: Record<HraSlug, Sprite> = { zenich: ZENICH_BEH[0], husky: HUSKY[0], prsten: PRSTEN };

/** Pixel-art ikona hry pro kartu v knihovně — stejný sprite jako ve hře. */
export default function IkonaHry({ hra, className }: { hra: HraSlug; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const sp = IKONY[hra];
    const m = 4;
    c.width = sp[0].length * m;
    c.height = sp.length * m;
    const css = getComputedStyle(document.documentElement);
    kresli(ctx, sp, 0, 0, css.getPropertyValue("--ink").trim() || "#2b2925", css.getPropertyValue("--accent").trim() || "#9a8158", m);
  }, [hra]);
  return <canvas ref={ref} className={className} aria-hidden />;
}
