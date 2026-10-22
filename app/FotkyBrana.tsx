"use client";

import { useCallback, useEffect, useState } from "react";
import FotoGalerie from "./FotoGalerie";
import s from "./brana.module.css";

/* Vstup do galerie fotek: u dveří sedí náš pes s kyticí a pustí dál jen toho,
   kdo ví, jak se jmenuje. Odpověď ověřuje server (/api/fotky/vstup) a nastaví
   httpOnly cookie, takže host odpovídá jen jednou. Prohlížeč odpověď nezná
   a jméno psa nesmí být nikde v kódu ani v názvech souborů — repozitář
   i stránka jsou veřejné.

   Na špatné jméno pes nakloní hlavu a bublina zkusí jinou hlášku, pole se
   zatřese. Na správné zavrtí a za chvilku se odhalí galerie. */

const VITANI = "Haf! Než vás pustím dál… jak se jmenuju?";
const SPATNE = [
  "Haf? Tak to nejsem já.",
  "Hmm… Na to neslyším.",
  "Zkuste to znovu, mám dobrou náladu.",
  "Psst… zeptejte se nevěsty nebo ženicha.",
];
const DOBRE = "Haf haf! Pojďte dál.";
/* Správcovské heslo zadané u stejných dveří — pes pozná paničku. */
const PANICKA = "Haf haf! Ahoj paničko.";
// jak dlouho pes vrtí, než se otevře galerie
const VRTENI_MS = 1300;

type Stav = "zjistuji" | "zavreno" | "vrti" | "otevreno";

export default function FotkyBrana() {
  const [stav, setStav] = useState<Stav>("zjistuji");
  const [hodnota, setHodnota] = useState("");
  const [pokusy, setPokusy] = useState(0);
  const [odesila, setOdesila] = useState(false);
  const [hlaska, setHlaska] = useState<string | null>(null);
  const [spravce, setSpravce] = useState(false);
  // stabilní identita — galerie ji má v závislostech načítání
  const zamknout = useCallback(() => setStav("zavreno"), []);

  // pustí nás pes rovnou? (cookie je httpOnly, musí se zeptat server)
  useEffect(() => {
    let zruseno = false;
    fetch("/api/fotky/vstup")
      .then((r) => (r.ok ? r.json() : { pristup: false }))
      .then((d: { pristup?: boolean; spravce?: boolean }) => {
        if (zruseno) return;
        setSpravce(!!d.spravce);
        setStav(d.pristup ? "otevreno" : "zavreno");
      })
      .catch(() => !zruseno && setStav("zavreno"));
    return () => {
      zruseno = true;
    };
  }, []);

  useEffect(() => {
    if (stav !== "vrti") return;
    const id = window.setTimeout(() => setStav("otevreno"), VRTENI_MS);
    return () => window.clearTimeout(id);
  }, [stav]);

  const odeslat = async (e: React.FormEvent) => {
    e.preventDefault();
    const odpoved = hodnota.trim();
    if (!odpoved || odesila) return;
    setOdesila(true);
    try {
      const r = await fetch("/api/fotky/vstup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ odpoved }),
      });
      if (r.ok) {
        const d: { spravce?: boolean } = await r.json().catch(() => ({}));
        setSpravce(!!d.spravce);
        setHlaska(null);
        setStav("vrti");
        return;
      }
      setHlaska(r.status === 429 ? "Uf, to bylo hodně pokusů. Chvilku si odpočinu, zkuste to za minutu." : null);
      if (r.status !== 429) setPokusy((p) => p + 1);
      setHodnota("");
    } catch {
      setHlaska("Haf… něco se pokazilo. Zkuste to prosím znovu.");
    } finally {
      setOdesila(false);
    }
  };

  if (stav === "otevreno") {
    // vypršela cookie / změnilo se heslo → zpátky ke psovi
    return <FotoGalerie zamceno={zamknout} spravce={spravce} naKonecSpravy={() => setSpravce(false)} />;
  }
  // než server odpoví, nic neblikne — jen místo, ať stránka neposkočí
  if (stav === "zjistuji") return <div className={s.cekani} aria-hidden="true" />;

  const vrti = stav === "vrti";
  const bublina =
    hlaska ??
    (vrti
      ? spravce
        ? PANICKA
        : DOBRE
      : pokusy === 0
        ? VITANI
        : SPATNE[(pokusy - 1) % SPATNE.length]);

  return (
    <div className={s.brana}>
      <div className={s.scena}>
        <p className={s.bublina} aria-live="polite" key={vrti ? "ok" : `${pokusy}-${hlaska ?? ""}`}>
          {bublina}
        </p>
        <img
          key={vrti ? "vrti" : `n${pokusy}`}
          className={`${s.pes} ${vrti ? s.vrti : pokusy > 0 ? s.nakloni : ""}`}
          src="/fotky/pes-s-kytici.png"
          alt="Náš pes s kyticí v tlamě hlídá vstup do galerie"
          width={320}
          height={340}
        />
      </div>
      {!vrti && (
        <form className={s.formular} onSubmit={odeslat}>
          <label htmlFor="brana-jmeno" className={s.popisek}>Jak se jmenuje náš pes?</label>
          <input
            id="brana-jmeno"
            key={pokusy}
            className={`${s.pole} ${pokusy > 0 ? s.treseni : ""}`}
            value={hodnota}
            onChange={(e) => setHodnota(e.target.value)}
            placeholder="jméno psa"
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="go"
            maxLength={60}
          />
          <button type="submit" className={`btn ${s.tlacitko}`} disabled={odesila}>
            Pustit dál
          </button>
        </form>
      )}
    </div>
  );
}
