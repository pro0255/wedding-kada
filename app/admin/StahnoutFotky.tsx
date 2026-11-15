"use client";

import { useState } from "react";
import { zabal, type SouborZipu } from "@/lib/zip";
import s from "./admin.module.css";

/* Stažení všech fotek (nebo videí) z galerie jako jeden ZIP. Soubory se
   stáhnou přímo z Cloudinary do prohlížeče a zip se složí tady — free
   Cloudinary ZIP archivy blokuje a přes Vercel by se nevešly.
   Bere se jen to, co je v galerii: fotka smazaná z galerie v zipu není. */

export type Polozka = { url: string; nahrano: string };

const NARAZ = 4; // souběžná stahování — rychle, ale bez zahlcení mobilní sítě

const dvojciferne = (n: number) => String(n).padStart(2, "0");

function nazevSouboru(p: Polozka, i: number): string {
  const pripona = p.url.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? "jpg";
  const d = new Date(p.nahrano);
  const kdy = `${d.getFullYear()}-${dvojciferne(d.getMonth() + 1)}-${dvojciferne(d.getDate())}_${dvojciferne(d.getHours())}-${dvojciferne(d.getMinutes())}`;
  return `${String(i + 1).padStart(3, "0")}_${kdy}.${pripona}`;
}

function Tlacitko({
  polozky,
  popisek,
  soubor,
}: {
  polozky: Polozka[];
  popisek: string;
  soubor: string;
}) {
  const [stav, setStav] = useState<{ hotovo: number } | null>(null);
  const [hlaska, setHlaska] = useState<string | null>(null);

  async function stahni() {
    setHlaska(null);
    // chronologicky, ať zip čte jako průběh dne
    const serazene = polozky.toSorted((a, b) => a.nahrano.localeCompare(b.nahrano));
    const vysledky: (SouborZipu | null)[] = Array.from({ length: serazene.length }, () => null);
    let dalsi = 0;
    let hotovo = 0;
    setStav({ hotovo });

    async function pracuj() {
      while (dalsi < serazene.length) {
        const i = dalsi++;
        const p = serazene[i];
        try {
          const r = await fetch(p.url);
          if (!r.ok) throw new Error(String(r.status));
          vysledky[i] = {
            nazev: nazevSouboru(p, i),
            data: new Uint8Array(await r.arrayBuffer()),
            datum: new Date(p.nahrano),
          };
        } catch {
          /* chybějící se jen přeskočí a nahlásí */
        }
        setStav({ hotovo: ++hotovo });
      }
    }

    try {
      await Promise.all(Array.from({ length: Math.min(NARAZ, serazene.length) }, pracuj));
      const stazene = vysledky.filter((v): v is SouborZipu => v !== null);
      if (stazene.length === 0) throw new Error("nic");
      const blob = new Blob(zabal(stazene) as BlobPart[], { type: "application/zip" });
      const odkaz = document.createElement("a");
      odkaz.href = URL.createObjectURL(blob);
      odkaz.download = soubor;
      odkaz.click();
      setTimeout(() => URL.revokeObjectURL(odkaz.href), 60_000);
      const chybi = serazene.length - stazene.length;
      setHlaska(
        chybi > 0 ? `Hotovo, ale ${chybi} se nepodařilo stáhnout — zkuste to znovu.` : "Hotovo.",
      );
    } catch {
      setHlaska("Stažení se nepovedlo. Zkontrolujte připojení a zkuste to znovu.");
    } finally {
      setStav(null);
    }
  }

  return (
    <div className={s.stahnout}>
      <button
        type="button"
        className={s.tlacitko}
        onClick={stahni}
        disabled={!!stav || polozky.length === 0}
      >
        {stav ? `Stahuji ${stav.hotovo} / ${polozky.length}…` : `${popisek} (${polozky.length})`}
      </button>
      {hlaska && (
        <p className={s.stahnoutHlaska} role="status">
          {hlaska}
        </p>
      )}
    </div>
  );
}

export default function StahnoutFotky({ fotky, videa }: { fotky: Polozka[]; videa: Polozka[] }) {
  return (
    <div className={s.stahnoutRada}>
      <Tlacitko
        polozky={fotky}
        popisek="Stáhnout všechny fotky"
        soubor="Katerina-a-Jakub-fotky.zip"
      />
      {videa.length > 0 && (
        <Tlacitko
          polozky={videa}
          popisek="Stáhnout všechna videa"
          soubor="Katerina-a-Jakub-videa.zip"
        />
      )}
    </div>
  );
}
