"use client";

import { useState } from "react";
import s from "./navrh.module.css";

/* Živý náhled jedné verze: stránka v iframu v plné velikosti, zmenšená
   transformací. Tak se chová přesně jako naostro — breakpointy podle šířky
   iframu, animace, klepání — jen je menší. Iframe se načte až u viewportu:
   několik verzí kreslí přes WebGL a prohlížeč unese jen omezený počet
   kontextů najednou. */
export default function Nahled({
  href,
  sirka,
  vyska,
  meritko,
  popisek,
}: {
  href: string;
  sirka: number;
  vyska: number;
  meritko: number;
  popisek: string;
}) {
  // nový klíč iframe znovu načte — animace se dají pustit od začátku
  const [klic, setKlic] = useState(0);
  return (
    <figure className={s.nahled}>
      <div className={s.okno} style={{ width: sirka * meritko, height: vyska * meritko }}>
        <iframe
          key={klic}
          src={href}
          title={`${popisek}: ${href}`}
          loading="lazy"
          width={sirka}
          height={vyska}
          style={{ transform: `scale(${meritko})` }}
        />
      </div>
      <figcaption className={s.popisek}>
        <span>{popisek}</span>
        <button type="button" className={s.znovu} onClick={() => setKlic((k) => k + 1)}>
          Načíst znovu
        </button>
      </figcaption>
    </figure>
  );
}
