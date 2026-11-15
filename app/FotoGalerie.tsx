"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { chybaZVyjimky, prectiChybu } from "@/lib/chyby";
import { deviceId } from "@/lib/deviceId";
import { useNahravani } from "./nahravani";
import NahravaniPanel from "./NahravaniPanel";
import WhatsappZaloha from "./WhatsappZaloha";

/**
 * Galerie fotek od hostů. Hosté nemají účty — prohlížeč se pozná podle
 * náhodného id v localStorage, přes které fungují lajky, „moje fotky“
 * a mazání vlastních fotek.
 *
 * Upload jde z mobilu přímo do Cloudinary (unsigned preset), přes náš
 * server letí jen malá registrace do Redisu. Nahrávání drží fronta
 * v telefonu (app/nahravani.ts) — na slabém signálu se nic neztratí,
 * zkouší se znovu a pokračuje i po zavření stránky.
 */
const OBNOVA_MS = 20_000;
// na slabém signálu nečekat na galerii donekonečna — radši ukázat uloženou
const NACTENI_MS = 12_000;
// poslední načtená galerie v telefonu, ať je bez signálu co ukázat
const ULOZENA = "kj-galerie";
/* hlášky k nahrávání */
const HLASKY = [
  "Nahráváme vaše vzpomínky…",
  "Chviličku strpení, prosím…",
  "Už to bude…",
  "Děkujeme za každou fotku i video…",
];

type Fotka = {
  id: string;
  url: string;
  nahrano: string;
  lajky: number;
  lajklJsem: boolean;
  moje: boolean;
};

function jeVideo(url: string): boolean {
  return url.includes("/video/upload/");
}

/* Náhledy mají crossOrigin="anonymous": Cloudinary posílá CORS hlavičky
   a service worker si pak náhled může uložit (offline galerie, méně
   kreditů). Bez něj by dostal neprůhlednou odpověď, kterou ukládat nejde. */

/** Cloudinary umí zmenšeniny přímo v URL — vložením transformace za /upload/.
 *  U videa vrací JPEG s prvním políčkem (so_0) jako náhled. */
function nahledUrl(url: string, sirka: number): string {
  if (jeVideo(url)) {
    return url
      .replace("/video/upload/", `/video/upload/w_${sirka},c_limit,q_auto,so_0/`)
      .replace(/\.[a-z0-9]+$/i, ".jpg");
  }
  return url.replace("/image/upload/", `/image/upload/w_${sirka},c_limit,q_auto,f_auto/`);
}

/** Video k přehrání: Cloudinary ho převede na menší (max 1280 px, q_auto).
 *  Telefonní 4K by jinak při každém přehrání stahovalo desítky MB z kreditů. */
function videoUrl(url: string): string {
  return url.replace("/video/upload/", "/video/upload/c_limit,w_1280,h_1280,q_auto/");
}

/** `zamceno` zavolá, když server odmítne přístup (cookie ze vstupu vypršela
 *  nebo se změnilo heslo) — FotkyBrana pak vrátí hosta ke psovi u dveří.
 *
 *  `spravce` je režim pro nevěstu se ženichem: smí smazat i cizí fotku.
 *  Zapíná se u stejných dveří, jen jiným heslem — tlačítko „Správa galerie“
 *  nic neprozrazuje, host se k němu dostane taky, ale bez hesla neprojde. */
export default function FotoGalerie({
  zamceno,
  spravce = false,
  naKonecSpravy,
}: {
  zamceno?: () => void;
  spravce?: boolean;
  naKonecSpravy?: () => void;
} = {}) {
  const [fotky, setFotky] = useState<Fotka[] | null>(null);
  const [ukazVse, setUkazVse] = useState(false);
  const [jenMoje, setJenMoje] = useState(false);
  const [hlaska, setHlaska] = useState(0);
  const [chyba, setChyba] = useState<string | null>(null);
  // po neúspěšném nahrání nabídne WhatsApp skupinu (odkaz posílá server s galerií)
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  const [zaloha, setZaloha] = useState(false);
  /* Selhání PRVNÍHO načtení. Odděleně od chyby nahrávání a odděleně od
     selhání průběžné obnovy: když už galerie fotky má, výpadek se přejde
     mlčky a zobrazené fotky zůstanou. Bez tohohle stavu zůstalo fotky = null
     napořád a host koukal na donekonečna pulzující skeletony. */
  const [nacteniSelhalo, setNacteniSelhalo] = useState(false);
  // zobrazená galerie je uložená z minula (bez signálu), ne čerstvá
  const [zUlozene, setZUlozene] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [nacitaVelkou, setNacitaVelkou] = useState(false);
  const device = useRef<string>("");
  const dotyk = useRef<{ x: number; y: number } | null>(null);
  // rozjednané lajky (fotkaId → cílový stav) — obnova ze serveru je nesmí přepsat
  const cekajiciLajky = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    device.current = deviceId();
  }, []);

  const nacti = useCallback(async () => {
    /* Bez odpovědi: když už galerie něco ukazuje, nechá to být; jinak zkusí
       uloženou z minula, a až když není ani ta, ohlásí chybu s tlačítkem. */
    const bezOdpovedi = () =>
      setFotky((f) => {
        if (f !== null) return f;
        try {
          const ulozena = JSON.parse(localStorage.getItem(ULOZENA) ?? "null") as {
            fotky: Fotka[];
            whatsapp: string | null;
          } | null;
          if (ulozena?.fotky) {
            setZUlozene(true);
            setWhatsapp(ulozena.whatsapp);
            return ulozena.fotky;
          }
        } catch {
          /* nic uloženého */
        }
        setNacteniSelhalo(true);
        return f;
      });

    const ovladac = new AbortController();
    const casovac = window.setTimeout(() => ovladac.abort(), NACTENI_MS);
    try {
      const odpoved = await fetch(`/api/fotky?device=${device.current}`, {
        signal: ovladac.signal,
      });
      if (odpoved.status === 401) return zamceno?.();
      if (!odpoved.ok) return bezOdpovedi();
      setNacteniSelhalo(false);
      setZUlozene(false);
      const data = (await odpoved.json()) as { fotky: Fotka[]; whatsapp?: string | null };
      setWhatsapp(data.whatsapp ?? null);
      try {
        localStorage.setItem(
          ULOZENA,
          JSON.stringify({ fotky: data.fotky, whatsapp: data.whatsapp ?? null }),
        );
      } catch {
        /* plné úložiště / soukromé okno — příště jen bez zálohy */
      }
      // server nese pravdu o lajcích ostatních; vlastní rozjednané se přes ni přeloží
      setFotky(
        data.fotky.map((f) => {
          const chteny = cekajiciLajky.current.get(f.id);
          if (chteny === undefined) return f;
          if (f.lajklJsem === chteny) {
            cekajiciLajky.current.delete(f.id); // server už lajk zná
            return f;
          }
          return { ...f, lajklJsem: chteny, lajky: Math.max(0, f.lajky + (chteny ? 1 : -1)) };
        }),
      );
    } catch {
      bezOdpovedi();
    } finally {
      window.clearTimeout(casovac);
    }
  }, [zamceno]);

  // první načtení + průběžná obnova (jen když je stránka vidět)
  useEffect(() => {
    nacti();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") nacti();
    }, OBNOVA_MS);
    return () => clearInterval(id);
  }, [nacti]);

  const {
    stav: nahravani,
    pridej,
    odeber,
  } = useNahravani({
    deviceId: () => device.current || deviceId(),
    aktivni: true,
    poNahrani: () => void nacti(),
    zamceno,
    naChybu: (zprava) => {
      setChyba(zprava);
      setZaloha(true);
    },
  });
  const nahrava = nahravani.soubory.length > 0 && !nahravani.hotovo;

  function nahraj(vybrane: FileList | null) {
    // FileList je živý — vyčištěním inputu by zmizel, tak si soubory zkopírujeme
    const soubory = [...(vybrane ?? [])];
    if (soubory.length === 0) return;
    if (
      !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
      !process.env.NEXT_PUBLIC_CLOUDINARY_PRESET
    ) {
      setChyba("Nahrávání zatím není nastavené.");
      setZaloha(true);
      return;
    }
    setChyba(null);
    setZaloha(false);
    void pridej(soubory);
  }

  // rotace hlášek během nahrávání
  useEffect(() => {
    if (!nahrava) return;
    setHlaska(Math.floor(Math.random() * HLASKY.length));
    const id = setInterval(() => setHlaska((h) => (h + 1) % HLASKY.length), 2600);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nahrava]);

  async function lajkni(fotka: Fotka) {
    const chteny = !fotka.lajklJsem;
    cekajiciLajky.current.set(fotka.id, chteny);
    // optimisticky — obnova ze serveru díky cekajiciLajky nic nepřepíše
    setFotky(
      (f) =>
        f?.map((x) =>
          x.id === fotka.id
            ? { ...x, lajklJsem: chteny, lajky: Math.max(0, x.lajky + (chteny ? 1 : -1)) }
            : x,
        ) ?? null,
    );
    try {
      const odpoved = await fetch("/api/fotky/lajk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotkaId: fotka.id, deviceId: device.current }),
      });
      if (!odpoved.ok) cekajiciLajky.current.delete(fotka.id); // příští obnova vrátí pravdu
    } catch {
      cekajiciLajky.current.delete(fotka.id);
    }
  }

  async function smaz(fotka: Fotka) {
    setFotky((f) => f?.filter((x) => x.id !== fotka.id) ?? null);
    setDetailId(null);
    /* Optimisticky pryč; když server smazání odmítne nebo nedojde, fotka se
       vrátí a host se dozví proč — dřív zmizela a po obnově se tiše vrátila. */
    const vrat = (hlaska: string) => {
      setFotky((f) =>
        f && !f.some((x) => x.id === fotka.id)
          ? [fotka, ...f].sort((a, b) => b.nahrano.localeCompare(a.nahrano))
          : f,
      );
      setChyba(hlaska);
    };
    try {
      const odpoved = await fetch("/api/fotky", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fotka.id, deviceId: device.current }),
      });
      if (odpoved.status === 401) return zamceno?.();
      if (!odpoved.ok) vrat((await prectiChybu(odpoved)).hlaska);
    } catch (error) {
      vrat(chybaZVyjimky(error).hlaska);
    }
  }

  /* Konec správcovství: cookie zruší server, tady se jen přepne režim.
     Host tím o přístup do galerie nepřijde, ta cookie je druhá. */
  async function konecSpravy() {
    try {
      await fetch("/api/fotky/vstup", { method: "DELETE" });
    } catch {
      /* i tak režim vypneme — po obnově stránky se stav srovná podle serveru */
    }
    naKonecSpravy?.();
  }

  const viditelne = fotky?.filter((f) => !jenMoje || f.moje) ?? [];
  const LIMIT = 24;
  const zobrazene = ukazVse ? viditelne : viditelne.slice(0, LIMIT);
  const mamNejake = (fotky ?? []).some((f) => f.moje);

  // prohlížečka: fotka se hledá podle id, takže přežije obnovu galerie
  const detailIndex = detailId ? viditelne.findIndex((f) => f.id === detailId) : -1;
  const detail = detailIndex >= 0 ? viditelne[detailIndex] : null;
  const predchozi = detail
    ? viditelne[(detailIndex - 1 + viditelne.length) % viditelne.length]
    : null;
  const nasledujici = detail ? viditelne[(detailIndex + 1) % viditelne.length] : null;

  function otevri(id: string) {
    setNacitaVelkou(true);
    setDetailId(id);
  }

  function posun(smer: -1 | 1) {
    const cil = smer === -1 ? predchozi : nasledujici;
    if (cil && cil.id !== detailId) otevri(cil.id);
  }

  // klávesy v prohlížečce + zámek scrollu pod ní
  useEffect(() => {
    if (!detailId) return;
    const naKlavesu = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetailId(null);
      if (e.key === "ArrowLeft") posun(-1);
      if (e.key === "ArrowRight") posun(1);
    };
    window.addEventListener("keydown", naKlavesu);
    const puvodni = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", naKlavesu);
      document.body.style.overflow = puvodni;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId, detailIndex, viditelne.length]);

  return (
    <div className="galerie-telo">
      {/* během nahrávání jde přidávat další — fronta je vezme za sebou */}
      <label className="btn galerie-upload">
        {nahrava ? "Přidat další" : "Nahrát fotky a videa"}
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => {
            nahraj(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      <NahravaniPanel stav={nahravani} hlaska={HLASKY[hlaska]} odeber={(id) => void odeber(id)} />

      {chyba && <p className="galerie-chyba">{chyba}</p>}
      {(zaloha || nahravani.problem) && whatsapp && <WhatsappZaloha odkaz={whatsapp} />}

      {zUlozene && (
        <p className="galerie-ulozena" role="status">
          Bez signálu — ukazuju fotky z posledního načtení. Nové se objeví, až se spojení vrátí.
        </p>
      )}

      {spravce && (
        <p className="galerie-spravce" role="status">
          Jsi tu jako správce — smazat můžeš i cizí fotku.{" "}
          <button type="button" onClick={konecSpravy}>
            Ukončit správu
          </button>
        </p>
      )}

      {mamNejake && (
        <div className="galerie-filtr">
          <button
            type="button"
            className={jenMoje ? "" : "aktivni"}
            onClick={() => setJenMoje(false)}
          >
            Všechny
          </button>
          <button
            type="button"
            className={jenMoje ? "aktivni" : ""}
            onClick={() => setJenMoje(true)}
          >
            Moje
          </button>
        </div>
      )}

      {fotky === null && nacteniSelhalo ? (
        <div className="galerie-nenacteno">
          <p>Galerie se teď nenačetla — nejspíš slabý signál.</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setNacteniSelhalo(false);
              nacti();
            }}
          >
            Zkusit znovu
          </button>
        </div>
      ) : fotky === null ? (
        <div className="galerie-mrizka" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="galerie-skeleton" style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
      ) : viditelne.length === 0 ? (
        <p className="galerie-prazdna">
          {jenMoje
            ? "Zatím jste nic nenahráli."
            : "Zatím tu nic není — buďte první, kdo něco nahraje!"}
        </p>
      ) : (
        <>
          <div className="galerie-mrizka">
            {zobrazene.map((f) => (
              <figure key={f.id} className="galerie-fotka">
                <button
                  type="button"
                  className="galerie-otevrit"
                  onClick={() => otevri(f.id)}
                  aria-label="Zobrazit fotku"
                >
                  <img
                    src={nahledUrl(f.url, 600)}
                    alt="Fotka od hosta"
                    loading="lazy"
                    crossOrigin="anonymous"
                  />
                  {jeVideo(f.url) && (
                    <span className="galerie-play" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M8 5.5v13l11-6.5z" />
                      </svg>
                    </span>
                  )}
                </button>
                {f.moje && <span className="galerie-moje">moje</span>}
                <button
                  type="button"
                  className={`galerie-srdce ${f.lajklJsem ? "lajknuto" : ""}`}
                  onClick={() => lajkni(f)}
                  aria-label={f.lajklJsem ? "Odebrat srdíčko" : "Dát srdíčko"}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 21s-7.5-4.8-10-9.3C.6 8.6 2.4 5 5.9 5c2 0 3.3 1 4.1 2.2h4c.8-1.2 2.1-2.2 4.1-2.2 3.5 0 5.3 3.6 3.9 6.7C19.5 16.2 12 21 12 21z" />
                  </svg>
                  {f.lajky > 0 && <b>{f.lajky}</b>}
                </button>
              </figure>
            ))}
          </div>
          {!ukazVse && viditelne.length > LIMIT && (
            <button type="button" className="btn galerie-vice" onClick={() => setUkazVse(true)}>
              Zobrazit všech {viditelne.length}
            </button>
          )}
        </>
      )}

      {!spravce && zamceno && (
        <button type="button" className="galerie-sprava-odkaz" onClick={zamceno}>
          Správa galerie
        </button>
      )}

      {detail && (
        <div
          className="galerie-detail"
          onClick={() => setDetailId(null)}
          onTouchStart={(e) => {
            dotyk.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }}
          onTouchEnd={(e) => {
            const start = dotyk.current;
            dotyk.current = null;
            if (!start) return;
            const dx = e.changedTouches[0].clientX - start.x;
            const dy = e.changedTouches[0].clientY - start.y;
            // vodorovné švihnutí = listování
            if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) posun(dx < 0 ? 1 : -1);
          }}
        >
          {jeVideo(detail.url) ? (
            /* Nic se nestahuje, dokud host neklepne na přehrát — listování
               galerií jinak stáhlo každé video, přes které přejel. Do té doby
               je vidět jen první snímek jako obrázek. */
            <video
              key={detail.id}
              src={videoUrl(detail.url)}
              poster={nahledUrl(detail.url, 1600)}
              preload="none"
              controls
              playsInline
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              key={detail.id}
              src={nahledUrl(detail.url, 1600)}
              alt="Fotka od hosta"
              crossOrigin="anonymous"
              className={nacitaVelkou ? "nacita" : ""}
              onLoad={() => setNacitaVelkou(false)}
            />
          )}
          {nacitaVelkou && !jeVideo(detail.url) && (
            <span className="galerie-nacitani" aria-hidden="true" />
          )}
          {/* sousední fotky se stáhnou dopředu — listování je pak okamžité */}
          {predchozi && predchozi.id !== detail.id && !jeVideo(predchozi.url) && (
            <link
              rel="preload"
              as="image"
              href={nahledUrl(predchozi.url, 1600)}
              crossOrigin="anonymous"
            />
          )}
          {nasledujici && nasledujici.id !== detail.id && !jeVideo(nasledujici.url) && (
            <link
              rel="preload"
              as="image"
              href={nahledUrl(nasledujici.url, 1600)}
              crossOrigin="anonymous"
            />
          )}
          {viditelne.length > 1 && (
            <>
              <button
                type="button"
                className="galerie-sipka galerie-sipka-l"
                aria-label="Předchozí fotka"
                onClick={(e) => {
                  e.stopPropagation();
                  posun(-1);
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="galerie-sipka galerie-sipka-p"
                aria-label="Další fotka"
                onClick={(e) => {
                  e.stopPropagation();
                  posun(1);
                }}
              >
                ›
              </button>
            </>
          )}
          <div className="galerie-detail-listy" onClick={(e) => e.stopPropagation()}>
            <span className="galerie-pocitadlo">
              {detailIndex + 1} / {viditelne.length}
            </span>
            <button
              type="button"
              className={`galerie-srdce galerie-srdce-velke ${detail.lajklJsem ? "lajknuto" : ""}`}
              onClick={() => lajkni(detail)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 21s-7.5-4.8-10-9.3C.6 8.6 2.4 5 5.9 5c2 0 3.3 1 4.1 2.2h4c.8-1.2 2.1-2.2 4.1-2.2 3.5 0 5.3 3.6 3.9 6.7C19.5 16.2 12 21 12 21z" />
              </svg>
              <b>{detail.lajky}</b>
            </button>
            {(detail.moje || spravce) && (
              <button type="button" className="galerie-smazat" onClick={() => smaz(detail)}>
                Smazat
              </button>
            )}
            <button type="button" className="galerie-zavrit" onClick={() => setDetailId(null)}>
              Zavřít
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
