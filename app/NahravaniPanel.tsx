"use client";

import type { StavNahravani } from "./nahravani";
import s from "./nahravani.module.css";

/* Panel nahrávání: host vidí každý vybraný soubor a co se s ním děje —
   čeká, nahrává se (procenta), hotovo, nebo se to zkusí znovu. Nahoře
   souhrn celé várky. Na slabém signálu je to jediné, co hosta uklidní,
   že se fotky neztratily. */

const pluralSouboru = (n: number, jedna: string, dve: string, pet: string) => {
  if (n === 1) return jedna;
  return n >= 2 && n <= 4 ? dve : pet;
};

function Odznak({ stav }: { stav: "ceka" | "nahrava" | "hotovo" | "znovu" }) {
  if (stav === "hotovo")
    return (
      <span className={`${s.odznak} ${s.odznakHotovo}`} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </span>
    );
  if (stav === "ceka")
    return (
      <span className={s.odznak} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      </span>
    );
  if (stav === "znovu")
    return (
      <span className={`${s.odznak} ${s.odznakZnovu}`} aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M19 12a7 7 0 1 1-2.05-4.95M19 5v4h-4" />
        </svg>
      </span>
    );
  return null;
}

const POPIS = {
  ceka: "čeká",
  nahrava: "nahrává se",
  hotovo: "nahráno",
  znovu: "zkusí se znovu",
} as const;

export default function NahravaniPanel({
  stav,
  hlaska,
  odeber,
}: {
  stav: StavNahravani;
  /** rotující povzbudivá hláška pod souhrnem */
  hlaska: string;
  odeber: (id: string) => void;
}) {
  const { soubory, ceka, hotovo } = stav;
  if (soubory.length === 0) return null;

  const celkem = soubory.length;
  const hotovych = soubory.filter((f) => f.stav === "hotovo").length;
  const zbyva = celkem - hotovych;
  const aktualni = soubory.find((f) => f.stav === "nahrava");
  const procento = Math.round(((hotovych + (aktualni?.procento ?? 0) / 100) / celkem) * 100);

  let titulek: string;
  let podtitulek: string;
  if (hotovo) {
    titulek = "Hotovo";
    podtitulek =
      celkem === 1 ? "Je v galerii. Děkujeme!" : `Všech ${celkem} je v galerii. Děkujeme!`;
  } else if (ceka === "signal") {
    titulek = "Bez signálu";
    podtitulek = `${zbyva} ${pluralSouboru(zbyva, "soubor čeká — nahraje se sám", "soubory čekají — nahrají se samy", "souborů čeká — nahraje se samo")}, jakmile bude připojení. Stránku můžete i zavřít.`;
  } else if (ceka === "znovu") {
    titulek = "Spojení vypadlo";
    podtitulek = "Za chvilku to zkusím znovu — nic se neztratí.";
  } else {
    titulek = `Nahrávám ${Math.min(hotovych + 1, celkem)} z ${celkem}`;
    podtitulek = hlaska;
  }

  return (
    <section
      className={`${s.panel} ${hotovo ? s.panelHotovo : ""} ${ceka ? s.panelCeka : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Nahrávání fotek"
    >
      <div className={s.hlava}>
        <p className={s.titulek}>
          {hotovo && (
            <svg className={s.titulekIkona} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          )}
          {ceka === "signal" && (
            <svg className={s.titulekIkona} viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 9a14 14 0 0 1 18 0M6.5 12.5a9 9 0 0 1 11 0M10 16a4 4 0 0 1 4 0M4 4l16 16" />
            </svg>
          )}
          {titulek}
          {!hotovo && !ceka && <span className={s.procentoCelkem}>{procento} %</span>}
        </p>
        <p className={s.podtitulek} key={podtitulek}>
          {podtitulek}
        </p>
      </div>

      {!hotovo && (
        <div className={s.bar} aria-hidden="true">
          <span style={{ width: `${hotovych === celkem ? 100 : procento}%` }} />
        </div>
      )}

      <ul className={s.soubory}>
        {soubory.map((f) => (
          <li key={f.id} className={`${s.soubor} ${s[f.stav]}`} title={POPIS[f.stav]}>
            {f.video ? (
              <video src={`${f.nahled}#t=0.1`} muted playsInline preload="metadata" />
            ) : (
              <img src={f.nahled} alt="" />
            )}
            {f.video && (
              <span className={s.videoZnak} aria-hidden="true">
                ▶
              </span>
            )}
            {f.stav === "nahrava" && (
              <>
                <span className={s.procento}>{f.procento} %</span>
                <span className={s.souborBar} aria-hidden="true">
                  <span style={{ width: `${f.procento}%` }} />
                </span>
              </>
            )}
            <Odznak stav={f.stav} />
            {(f.stav === "ceka" || f.stav === "znovu") && (
              <button
                type="button"
                className={s.odebrat}
                onClick={() => odeber(f.id)}
                aria-label="Odebrat ze seznamu"
              >
                ×
              </button>
            )}
            <span className={s.srOnly}>{POPIS[f.stav]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
