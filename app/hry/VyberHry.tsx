"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HRY, type HraSlug } from "@/lib/schemata";
import type { Lidr } from "@/lib/hra";
import { HRY_REGISTR } from "./hry";
import IkonaHry from "./IkonaHry";
import s from "./hry.module.css";
import h2 from "./hra.module.css";

type Lidri = Partial<Record<HraSlug, Lidr>>;

/** Tři karty her s aktuálním lídrem. Buď odkazy na /hry/<slug>, nebo
    tlačítka (onVyber) — na 404 se hra otevírá rovnou na místě. */
export default function VyberHry({ onVyber }: { onVyber?: (hra: HraSlug) => void }) {
  const [lidri, setLidri] = useState<Lidri>({});

  useEffect(() => {
    fetch("/api/hra/lidri")
      .then((r) => (r.ok ? (r.json() as Promise<Lidri>) : {}))
      .then(setLidri)
      .catch(() => {});
  }, []);

  return (
    <ul className={s.karty}>
      {HRY.map((slug) => {
        const h = HRY_REGISTR[slug];
        const l = lidri[slug];
        const obsah = (
          <>
            <IkonaHry hra={slug} className={s.kartaIkona} />
            <span className={s.kartaNazev}>{h.nazev}</span>
            <span className={s.kartaPopis}>{h.popis}</span>
            <span className={s.kartaLidr}>
              {l === undefined ? (
                " "
              ) : l === null ? (
                "Ještě nikdo nehrál"
              ) : (
                <>
                  <span className={s.kartaLidrPopisek}>Vede</span> {l.jmeno} ·{" "}
                  <strong>
                    {l.skore} {h.jednotka}
                  </strong>
                </>
              )}
            </span>
          </>
        );
        return (
          <li key={slug}>
            {onVyber ? (
              <button type="button" className={s.karta} onClick={() => onVyber(slug)}>
                {obsah}
              </button>
            ) : (
              <Link href={`/hry/${slug}`} className={s.karta}>
                {obsah}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
