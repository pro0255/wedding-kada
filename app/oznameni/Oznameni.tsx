"use client";

import { useEffect, useRef, useState } from "react";
import s from "./oznameni.module.css";

/* šířka karty A5 v CSS pixelech (148 mm při 96 dpi) */
const SIRKA_PX = (148 / 25.4) * 96;

/* Texty na kartě na jednom místě, ať se ladí bez hledání v JSX. Málo slov
   schválně — všechno ostatní (čas, program, adresa) najdou hosté na webu. */
const T = {
  uvod: "bereme se",
  nevesta: "Kateřina",
  zenich: "Jakub",
  datum: "18. září 2027",
  cas: "ve 12 hodin",
  misto: "u zvoničky v Rekovicích",
};

export default function Oznameni() {
  const obal = useRef<HTMLDivElement>(null);
  const [skala, setSkala] = useState(1);

  /* Na telefonu se karta zmenší, aby se vešla na šířku; ladí se ale v 1:1.
     Transform nezmenší místo v toku, výšku proto drží obal přes --skala. */
  useEffect(() => {
    const el = obal.current;
    if (!el) return;
    const zmer = () => setSkala(Math.min(1, el.clientWidth / SIRKA_PX));
    zmer();
    const ro = new ResizeObserver(zmer);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <main className={s.stranka}>
      {/* lišta jen na obrazovce — v tisku se skryje */}
      <div className={s.lista}>
        <div>
          <strong>Svatební oznámení</strong>
          <span className={s.napoveda}>
            A5 · v dialogu tisku zvolte „Uložit jako PDF“, okraje „Žádné“ a zapněte grafiku pozadí
          </span>
        </div>
        <button type="button" className={s.tlacitko} onClick={() => window.print()}>
          Exportovat do PDF
        </button>
      </div>

      <div className={s.obal} ref={obal} style={{ "--skala": skala } as React.CSSProperties}>
      <section className={s.karta} aria-label="Svatební oznámení">
        <div className={s.oval}>
          <p className={s.uvod}>{T.uvod}</p>
          <h1 className={s.jmena}>
            <span className={s.jmeno}>{T.nevesta}</span>
            <span className={s.a}>&amp;</span>
            <span className={s.jmeno}>{T.zenich}</span>
          </h1>
          <i className={s.linka} />
          <p className={s.datum}>{T.datum}</p>
          <p className={s.detail}>
            {T.cas}
            <br />
            {T.misto}
          </p>
        </div>

        {/* louka: podklad s kytkami otočený o 90°, roste zespodu a zakrývá
            dolní oblouk oválu — vzniká hloubka, ne rámeček z tapety */}
        <img className={s.louka} src="/oznameni/louka.png" alt="" />
      </section>
      </div>
    </main>
  );
}
