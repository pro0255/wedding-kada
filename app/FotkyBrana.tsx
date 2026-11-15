"use client";

import { useCallback, useEffect, useState } from "react";
import { chybaZVyjimky, prectiChybu, type Chyba } from "@/lib/chyby";
import { deviceId } from "@/lib/deviceId";
import s from "./brana.module.css";
import { Svedci } from "./ChybaHlaska";
import FotoGalerie from "./FotoGalerie";

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

/* Značka „tenhle prohlížeč už vstupem prošel“. Nic neodemyká — fotky dál
   hlídá httpOnly cookie na serveru. Slouží jen offline: když se server
   nedá zeptat, galerie se otevře a ukáže kopii uloženou v telefonu. */
const ZNACKA = "kj-fotky-pristup";
function zapamatujVstup(prosel: boolean) {
  try {
    if (prosel) localStorage.setItem(ZNACKA, "1");
    else localStorage.removeItem(ZNACKA);
  } catch {
    /* soukromé okno — offline se pak prostě zeptá pes */
  }
}
function proselMinule(): boolean {
  try {
    return localStorage.getItem(ZNACKA) === "1";
  } catch {
    return false;
  }
}

export default function FotkyBrana() {
  const [stav, setStav] = useState<Stav>("zjistuji");
  const [hodnota, setHodnota] = useState("");
  const [pokusy, setPokusy] = useState(0);
  const [odesila, setOdesila] = useState(false);
  const [chyba, setChyba] = useState<Chyba | null>(null);
  const [spravce, setSpravce] = useState(false);
  // stabilní identita — galerie ji má v závislostech načítání
  const zamknout = useCallback(() => {
    zapamatujVstup(false); // server řekl 401
    setStav("zavreno");
  }, []);

  // pustí nás pes rovnou? (cookie je httpOnly, musí se zeptat server)
  useEffect(() => {
    let zruseno = false;
    fetch("/api/fotky/vstup")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((d: { pristup?: boolean; spravce?: boolean }) => {
        if (zruseno) return;
        zapamatujVstup(!!d.pristup);
        setSpravce(!!d.spravce);
        setStav(d.pristup ? "otevreno" : "zavreno");
      })
      // bez signálu / výpadek serveru: kdo už jednou prošel, jde dál
      .catch(() => !zruseno && setStav(proselMinule() ? "otevreno" : "zavreno"));
    return () => {
      zruseno = true;
    };
  }, []);

  useEffect(() => {
    if (stav !== "vrti") return;
    const id = globalThis.setTimeout(() => setStav("otevreno"), VRTENI_MS);
    return () => globalThis.clearTimeout(id);
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
        body: JSON.stringify({ odpoved, deviceId: deviceId() }),
      });
      if (r.ok) {
        const d: { spravce?: boolean } = await r.json().catch(() => ({}));
        setSpravce(!!d.spravce);
        setChyba(null);
        zapamatujVstup(true);
        setStav("vrti");
        return;
      }
      /* Špatné jméno je jen jeden z důvodů, proč server odmítne. Dřív se
         jako špatný pokus počítal i výpadek serveru — pes pak tvrdil
         „to nejsem já“ i na správné jméno. */
      const duvod = await prectiChybu(r);
      if (duvod.kod === "spatna-odpoved") {
        setChyba(null);
        setPokusy((p) => p + 1);
        setHodnota("");
      } else {
        setChyba(duvod);
        // jméno necháme v poli — až to půjde, stačí klepnout znovu
        if (duvod.kod === "moc-pokusu") setHodnota("");
      }
    } catch (error) {
      setChyba(chybaZVyjimky(error));
    } finally {
      setOdesila(false);
    }
  };

  if (stav === "otevreno") {
    // vypršela cookie / změnilo se heslo → zpátky ke psovi
    return (
      <FotoGalerie zamceno={zamknout} spravce={spravce} naKonecSpravy={() => setSpravce(false)} />
    );
  }
  // než server odpoví, nic neblikne — jen místo, ať stránka neposkočí
  if (stav === "zjistuji") return <div className={s.cekani} aria-hidden="true" />;

  const vrti = stav === "vrti";
  let hlaska: string | null = null;
  if (chyba) hlaska = chyba.kod === "moc-pokusu" ? chyba.hlaska : `Haf… ${chyba.hlaska}`;
  let bezChyby: string;
  if (vrti) bezChyby = spravce ? PANICKA : DOBRE;
  else bezChyby = pokusy === 0 ? VITANI : SPATNE[(pokusy - 1) % SPATNE.length];
  const bublina = hlaska ?? bezChyby;
  let tridaPsa = "";
  if (vrti) tridaPsa = s.vrti;
  else if (pokusy > 0) tridaPsa = s.nakloni;

  return (
    <div className={s.brana}>
      <div className={s.scena}>
        <p className={s.bublina} aria-live="polite" key={vrti ? "ok" : `${pokusy}-${hlaska ?? ""}`}>
          {bublina}
        </p>
        <img
          key={vrti ? "vrti" : `n${pokusy}`}
          className={`${s.pes} ${tridaPsa}`}
          src="/fotky/pes-s-kytici.png"
          alt="Náš pes s kyticí v tlamě hlídá vstup do galerie"
          width={320}
          height={340}
        />
      </div>
      {!vrti && (
        <form className={s.formular} onSubmit={odeslat}>
          <label htmlFor="brana-jmeno" className={s.popisek}>
            Jak se jmenuje náš pes?
          </label>
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
      {!vrti && chyba?.kontakt && <Svedci />}
    </div>
  );
}
