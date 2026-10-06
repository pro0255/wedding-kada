"use client";

/* Hromádka fotek, kterou lze listovat klepnutím.

   Sadu fotek si bere zvenku, takže stejná komponenta slouží příběhu
   i ubytování — u ubytování bez popisků, tam fotky mluví samy. Proto
   stojí ve vlastním souboru a ne v page.tsx, odkud by se do Ubytovani.tsx
   dovézt nedala. */

import { useState } from "react";
import { motion } from "motion/react";
import { IkonaKlik } from "./StoryDoodles";

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

/* Hromádka fotek, kterou lze listovat. Sadu si bere zvenku, takže ji používá
   příběh i ubytování — u ubytování bez popisků, tam fotky mluví samy. */
export default function FotoHromadka({ fotky }: { fotky: FotkaNaHromadce[] }) {
  const [aktivni, setAktivni] = useState(0);
  // až po prvním kliknutí smí odcházející fotka animovat odchod — jinak by
  // spodní fotka při prvním vykreslení bliknula
  const [listoval, setListoval] = useState(false);
  const pocet = fotky.length;

  return (
    <button
      type="button"
      /* Jakmile host začne listovat, couvnou květiny nad kompozicí dozadu —
         přes fotku, kterou si prohlíží, nemá co ležet. */
      className={"foto-hromadka" + (listoval ? " je-listovano" : "")}
      onClick={() => {
        setListoval(true);
        setAktivni((i) => (i + 1) % pocet);
      }}
      aria-label="Zobrazit další fotku"
    >
      {fotky.map((foto, i) => {
        const slot = (i - aktivni + pocet) % pocet;
        const viditelny = slot < HROMADKA_SLOTY.length;
        // fotka, která právě odešla z vršku — odhodí se doprava a zapadne pod hromádku
        const odchazi = listoval && slot === pocet - 1;
        const poloha = HROMADKA_SLOTY[Math.min(slot, HROMADKA_SLOTY.length - 1)];
        return (
          <motion.img
            key={foto.src}
            src={foto.src}
            alt={slot === 0 ? foto.alt : ""}
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
          <img className="foto-popis-obrazek" src={fotky[aktivni].popisSrc} alt={fotky[aktivni].popis ?? ""} />
        ) : (
          <span className="foto-popis-text">{fotky[aktivni].popis}</span>
        )}
      </span>
      {/* Odznak s kurzorem v rohu — zve k listování a zůstává vidět pořád.
          Popisky konkrétních fotek („zásnuby na Troskách“ a spol.) tu byly nad
          hromádkou a šly pryč; komponenty v StoryDoodles.tsx zůstávají. */}
      <span className="doodle-obal ikona-klik-obal" aria-hidden="true">
        <IkonaKlik />
      </span>
    </button>
  );
}
