"use client";

/* Hromádka fotek, kterou lze listovat.

   Sadu fotek si bere zvenku, takže stejná komponenta slouží příběhu
   i ubytování — u ubytování bez popisků, tam fotky mluví samy. Proto
   stojí ve vlastním souboru a ne v page.tsx, odkud by se do Ubytovani.tsx
   dovézt nedala.

   Listuje se, jak kdo zvykne: klepnutím na pravou část fotky dál, na levou
   třetinu zpět, tahem prstu do strany, šipkami na klávesnici a tlačítky
   pod hromádkou, kde je i počítadlo. */

import { startTransition, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

/* `popisSrc` je popisek vysázený ručním písmem a uložený jako obrázek — to písmo
   na webu nemáme, tak přišel hotový. `popis` u něj zůstává jako text pro
   odečítače. */
export type FotkaNaHromadce = { src: string; alt: string; popis?: string; popisSrc?: string };
/* jak leží jednotlivé fotky na hromádce (0 = úplně navrchu) */
const HROMADKA_SLOTY = [
  { rot: -1.5, x: 0, y: 0 },
  { rot: 3.2, x: 12, y: 8 },
  { rot: -4, x: -10, y: 15 },
  { rot: 2.4, x: 6, y: 22 },
];
// levá část fotky, kde klepnutí vrací zpět
const ZPET_PODIL = 0.35;
// tah prstem kratší než tohle je klepnutí, ne listování
const TAH_PX = 40;

export default function FotoHromadka({
  fotky,
  nazev = "Fotky",
}: {
  fotky: FotkaNaHromadce[];
  nazev?: string;
}) {
  const [aktivni, setAktivni] = useState(0);
  // Směr posledního listování. Dokud se nelistovalo, odcházející fotka nesmí
  // animovat odchod — jinak by spodní fotka při prvním vykreslení bliknula.
  const [smer, setSmer] = useState<"dal" | "zpet" | null>(null);
  const pocet = fotky.length;
  const tah = useRef<{ x: number; y: number } | null>(null);
  const tahlo = useRef(false);
  const obal = useRef<HTMLDivElement>(null);

  /* Fotky pod hromádkou jsou neviditelné, takže je prohlížeč dekóduje až ve
     chvíli, kdy se při listování poprvé ukážou — a to v prvním snímku
     animace (na pomalém telefonu jedno cuknutí). Proto se dekódují předem,
     jakmile je hromádka blízko, jedna po druhé ve volných chvílích. */
  useEffect(() => {
    const el = obal.current;
    if (!el) return;
    let zruseno = false;
    const klid = () =>
      new Promise<void>((r) =>
        typeof requestIdleCallback === "function"
          ? requestIdleCallback(() => r(), { timeout: 500 })
          : window.setTimeout(r, 50),
      );
    const io = new IntersectionObserver(
      async (zaznamy) => {
        if (!zaznamy.some((z) => z.isIntersecting)) return;
        io.disconnect();
        for (const img of el.querySelectorAll<HTMLImageElement>("img.foto-list")) {
          await klid();
          if (zruseno) return;
          await img.decode().catch(() => undefined);
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => {
      zruseno = true;
      io.disconnect();
    };
  }, []);

  /* Překreslení všech fotek běží v přechodu (startTransition): React ho rozloží
     do víc snímků, takže první snímek po klepnutí nečeká na celou hromádku. */
  const dal = () =>
    startTransition(() => {
      setSmer("dal");
      setAktivni((i) => (i + 1) % pocet);
    });
  const zpet = () =>
    startTransition(() => {
      setSmer("zpet");
      setAktivni((i) => (i - 1 + pocet) % pocet);
    });

  return (
    <div
      ref={obal}
      className="foto-hromadka-obal"
      role="group"
      aria-roledescription="galerie"
      aria-label={nazev}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); dal(); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); zpet(); }
      }}
    >
      <div
        className={"foto-hromadka" + (smer ? " je-listovano" : "")}
        onPointerDown={(e) => {
          tah.current = { x: e.clientX, y: e.clientY };
          tahlo.current = false;
        }}
        onPointerUp={(e) => {
          const z = tah.current;
          tah.current = null;
          if (!z) return;
          const dx = e.clientX - z.x;
          const dy = e.clientY - z.y;
          if (Math.abs(dx) > TAH_PX && Math.abs(dx) > Math.abs(dy)) {
            tahlo.current = true; // click, který přijde po tahu, se ignoruje
            if (dx < 0) dal();
            else zpet();
          }
        }}
        onPointerCancel={() => (tah.current = null)}
        onClick={(e) => {
          if (tahlo.current) {
            tahlo.current = false;
            return;
          }
          const r = e.currentTarget.getBoundingClientRect();
          if (e.clientX - r.left < r.width * ZPET_PODIL) zpet();
          else dal();
        }}
      >
        {fotky.map((foto, i) => {
          const slot = (i - aktivni + pocet) % pocet;
          const viditelny = slot < HROMADKA_SLOTY.length;
          // fotka, která právě odešla z vršku — sklouzne a zapadne pod hromádku
          const odchazi = smer === "dal" && slot === pocet - 1;
          const poloha = HROMADKA_SLOTY[Math.min(slot, HROMADKA_SLOTY.length - 1)];
          return (
            <motion.img
              loading="lazy"
              decoding="async"
              key={foto.src}
              src={foto.src}
              alt={slot === 0 ? foto.alt : ""}
              draggable={false}
              className={`foto-list ${slot === 0 ? "foto-vrchni" : ""}`}
              initial={false}
              animate={
                odchazi
                  ? {
                      // decentní: fotka jen kousek sklouzne a rozplyne se
                      // nad tou další — působí to jako listování, ne odhazování
                      x: 22, y: 12, rotate: 2.5, opacity: 0,
                    }
                  : {
                      x: poloha.x,
                      y: poloha.y,
                      rotate: poloha.rot,
                      opacity: viditelny ? 1 : 0,
                    }
              }
              transition={
                odchazi
                  ? { duration: 0.5, ease: "easeOut" }
                  : { type: "spring", stiffness: 170, damping: 26, mass: 1 }
              }
              style={{ zIndex: odchazi ? pocet + 1 : pocet - slot }}
            />
          );
        })}
        {/* Popisek leží ve stejném rámu jako vrchní fotka a otáčí se s ní stejně,
            proto sedí v jejím bílém pruhu, ne vedle něj. */}
        <span
          className="foto-popis"
          aria-hidden="true"
          style={{ opacity: fotky[aktivni].popis || fotky[aktivni].popisSrc ? 1 : 0, zIndex: pocet + 1 }}
        >
          {fotky[aktivni].popisSrc ? (
            <img loading="lazy" decoding="async" className="foto-popis-obrazek" src={fotky[aktivni].popisSrc} alt={fotky[aktivni].popis ?? ""} />
          ) : (
            <span className="foto-popis-text">{fotky[aktivni].popis}</span>
          )}
        </span>
        {/* Napověda při najetí myší: na kterou stranu klepnutí listuje. */}
        <span className="foto-sipka foto-sipka-zpet" aria-hidden="true">‹</span>
        <span className="foto-sipka foto-sipka-dal" aria-hidden="true">›</span>
      </div>

      <div className="foto-ovladani">
        <button type="button" className="foto-tlacitko" onClick={zpet} aria-label="Předchozí fotka">
          ‹
        </button>
        <span className="foto-pocet" aria-live="polite">
          <span className="jen-pro-odecitace">Fotka </span>
          {aktivni + 1}
          <span aria-hidden="true"> / </span>
          <span className="jen-pro-odecitace"> z </span>
          {pocet}
        </span>
        <button type="button" className="foto-tlacitko" onClick={dal} aria-label="Další fotka">
          ›
        </button>
      </div>
    </div>
  );
}
