"use client";

import { useEffect, useState } from "react";
import { deviceId } from "@/lib/deviceId";
import type { HraSlug, Zebricek as Data } from "@/lib/hra";
import s from "./hra.module.css";

/** Top 10 pro hru. Obnovuje se po každém dohrání (prop `obnovit`) a každých
    30 s, jen když je stránka vidět — Airtable free má limit požadavků. */
export default function Zebricek({ hra, obnovit }: { hra: HraSlug; obnovit: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [chyba, setChyba] = useState(false);

  useEffect(() => {
    let zivy = true;
    async function nacti() {
      try {
        const r = await fetch(`/api/hra?hra=${hra}&device=${deviceId()}`, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as Data;
        if (zivy) {
          setData(d);
          setChyba(false);
        }
      } catch {
        if (zivy) setChyba(true);
      }
    }
    nacti();
    const t = setInterval(() => {
      if (!document.hidden) nacti();
    }, 30000);
    return () => {
      zivy = false;
      clearInterval(t);
    };
  }, [hra, obnovit]);

  return (
    <section className={s.zebricek} aria-label="Žebříček">
      <h3 className="serif">Žebříček</h3>
      {chyba && <p className={s.tlumene}>Žebříček se teď nenačetl.</p>}
      {!data && !chyba && (
        <ol className={s.radky} aria-busy="true" aria-label="Načítám žebříček">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <span className={s.kostra} style={{ width: "1.4em" }} />
              <span className={s.kostra} style={{ width: `${55 - i * 12}%` }} />
              <span className={s.kostra} style={{ width: "2.2em" }} />
            </li>
          ))}
        </ol>
      )}
      {data && data.radky.length === 0 && (
        <p className={s.tlumene}>Ještě nikdo nehrál. Buď první.</p>
      )}
      {data && data.radky.length > 0 && (
        <ol className={s.radky}>
          {data.radky.map((r, i) => (
            <li key={i} className={r.moje ? s.moje : undefined}>
              <span className={s.poradi}>{r.poradi}.</span>
              <span className={s.jmeno}>{r.jmeno}</span>
              <span className={s.body}>{r.skore}</span>
            </li>
          ))}
        </ol>
      )}
      {data?.moje && data.moje.poradi > data.radky.length && (
        <p className={s.tlumene}>
          Ty: {data.moje.poradi}. místo, {data.moje.skore} bodů
        </p>
      )}
    </section>
  );
}
