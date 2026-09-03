"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deviceId } from "@/lib/deviceId";

/**
 * Galerie fotek od hostů. Hosté nemají účty — prohlížeč se pozná podle
 * náhodného id v localStorage, přes které fungují lajky, „moje fotky“
 * a mazání vlastních fotek.
 *
 * Upload jde z mobilu přímo do Cloudinary (unsigned preset), přes náš
 * server letí jen malá registrace do Airtable. Před uploadem se fotka
 * zmenší na canvasu — šetří data hostů i free tier.
 */
const MAX_STRANA = 2000;
const KVALITA = 0.85;
const OBNOVA_MS = 20_000;
const MAX_VIDEO_B = 100 * 1024 * 1024; // limit Cloudinary free tieru

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

/** Upload přes XHR — fetch neumí hlásit průběh odesílání. */
function nahrajDoCloudinary(
  soubor: Blob,
  cloud: string,
  preset: string,
  naPokrok: (podil: number) => void
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((vyres, zamitni) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) naPokrok(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status < 300
        ? vyres(JSON.parse(xhr.responseText))
        : zamitni(new Error(xhr.responseText));
    xhr.onerror = () => zamitni(new Error("síť"));
    const data = new FormData();
    data.append("file", soubor);
    data.append("upload_preset", preset);
    xhr.send(data);
  });
}

/** Zmenší fotku na canvasu; když to nejde (např. exotický formát), pošle originál. */
async function zmensi(soubor: File): Promise<Blob> {
  const objektUrl = URL.createObjectURL(soubor);
  try {
    const img = new Image();
    img.src = objektUrl;
    await img.decode();

    const pomer = Math.min(1, MAX_STRANA / Math.max(img.naturalWidth, img.naturalHeight));
    if (pomer === 1 && soubor.type === "image/jpeg") return soubor;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * pomer);
    canvas.height = Math.round(img.naturalHeight * pomer);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", KVALITA)
    );
    return blob ?? soubor;
  } catch {
    return soubor;
  } finally {
    URL.revokeObjectURL(objektUrl);
  }
}

export default function FotoGalerie() {
  const [fotky, setFotky] = useState<Fotka[] | null>(null);
  const [ukazVse, setUkazVse] = useState(false);
  const [jenMoje, setJenMoje] = useState(false);
  const [prubeh, setPrubeh] = useState<{ hotovo: number; celkem: number; procento: number } | null>(null);
  const [hlaska, setHlaska] = useState(0);
  const [chyba, setChyba] = useState<string | null>(null);
  /* Selhání PRVNÍHO načtení. Odděleně od chyby nahrávání a odděleně od
     selhání průběžné obnovy: když už galerie fotky má, výpadek se přejde
     mlčky a zobrazené fotky zůstanou. Bez tohohle stavu zůstalo fotky = null
     napořád a host koukal na donekonečna pulzující skeletony. */
  const [nacteniSelhalo, setNacteniSelhalo] = useState(false);
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
    try {
      const odpoved = await fetch(`/api/fotky?device=${device.current}`);
      if (!odpoved.ok) {
        setFotky((f) => (f === null ? (setNacteniSelhalo(true), f) : f));
        return;
      }
      setNacteniSelhalo(false);
      const data = (await odpoved.json()) as { fotky: Fotka[] };
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
        })
      );
    } catch {
      /* galerie zůstane, jak byla; hlásíme jen když ještě nic nemáme */
      setFotky((f) => (f === null ? (setNacteniSelhalo(true), f) : f));
    }
  }, []);

  // první načtení + průběžná obnova (jen když je stránka vidět)
  useEffect(() => {
    nacti();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") nacti();
    }, OBNOVA_MS);
    return () => clearInterval(id);
  }, [nacti]);

  async function nahraj(vybrane: FileList | null) {
    // FileList je živý — vyčištěním inputu by zmizel, tak si soubory zkopírujeme
    const soubory = Array.from(vybrane ?? []);
    if (!soubory.length || prubeh) return;
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET;
    if (!cloud || !preset) {
      setChyba("Nahrávání zatím není nastavené.");
      return;
    }

    setChyba(null);
    const celkem = soubory.length;
    let selhalo = 0;
    let prilisVelke = 0;

    for (let i = 0; i < celkem; i++) {
      const naPokrok = (podil: number) =>
        setPrubeh({
          hotovo: i,
          celkem,
          procento: Math.min(99, Math.round(((i + podil) / celkem) * 100)),
        });
      naPokrok(0);
      try {
        const soubor = soubory[i];
        let telo: Blob;
        if (soubor.type.startsWith("video/")) {
          if (soubor.size > MAX_VIDEO_B) {
            prilisVelke++;
            continue;
          }
          telo = soubor; // video se nahrává tak, jak je
        } else {
          telo = await zmensi(soubor);
        }

        const { secure_url, public_id } = await nahrajDoCloudinary(
          telo,
          cloud,
          preset,
          naPokrok
        );

        const registrace = await fetch("/api/fotky", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: secure_url, publicId: public_id, deviceId: device.current }),
        });
        if (!registrace.ok) throw new Error(String(registrace.status));
      } catch {
        selhalo++;
      }
    }

    setPrubeh(null);
    const zpravy: string[] = [];
    if (prilisVelke > 0) {
      zpravy.push(
        prilisVelke === 1
          ? "Jedno video je příliš velké (max. 100 MB)."
          : prilisVelke < 5
            ? `${prilisVelke} videa jsou příliš velká (max. 100 MB).`
            : `${prilisVelke} videí je příliš velkých (max. 100 MB).`
      );
    }
    if (selhalo > 0) {
      zpravy.push(
        selhalo + prilisVelke === celkem
          ? "Nahrání se nezdařilo. Zkontrolujte prosím připojení a zkuste to znovu."
          : `Nahrálo se ${celkem - selhalo - prilisVelke} z ${celkem} souborů, zbytek zkuste prosím znovu.`
      );
    }
    if (zpravy.length) setChyba(zpravy.join(" "));
    nacti();
  }

  // rotace hlášek během nahrávání
  useEffect(() => {
    if (!prubeh) return;
    setHlaska(Math.floor(Math.random() * HLASKY.length));
    const id = setInterval(() => setHlaska((h) => (h + 1) % HLASKY.length), 2600);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!prubeh]);

  async function lajkni(fotka: Fotka) {
    const chteny = !fotka.lajklJsem;
    cekajiciLajky.current.set(fotka.id, chteny);
    // optimisticky — obnova ze serveru díky cekajiciLajky nic nepřepíše
    setFotky(
      (f) =>
        f?.map((x) =>
          x.id === fotka.id
            ? { ...x, lajklJsem: chteny, lajky: Math.max(0, x.lajky + (chteny ? 1 : -1)) }
            : x
        ) ?? null
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
    try {
      await fetch("/api/fotky", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: fotka.id, deviceId: device.current }),
      });
    } catch {
      /* při obnově se případně vrátí */
    }
  }

  const viditelne = fotky?.filter((f) => !jenMoje || f.moje) ?? [];
  const LIMIT = 24;
  const zobrazene = ukazVse ? viditelne : viditelne.slice(0, LIMIT);
  const mamNejake = (fotky ?? []).some((f) => f.moje);

  // prohlížečka: fotka se hledá podle id, takže přežije obnovu galerie
  const detailIndex = detailId ? viditelne.findIndex((f) => f.id === detailId) : -1;
  const detail = detailIndex >= 0 ? viditelne[detailIndex] : null;
  const predchozi = detail ? viditelne[(detailIndex - 1 + viditelne.length) % viditelne.length] : null;
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
      <label className={`btn galerie-upload ${prubeh ? "galerie-upload-bezi" : ""}`}>
        {prubeh ? "Nahrává se…" : "Nahrát fotky a videa"}
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          disabled={!!prubeh}
          onChange={(e) => {
            nahraj(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {prubeh && (
        <div className="galerie-prubeh" role="status">
          <div className="galerie-prubeh-bar">
            <span style={{ width: `${prubeh.procento}%` }} />
          </div>
          <p className="galerie-prubeh-text">
            {prubeh.hotovo + 1} / {prubeh.celkem} · {prubeh.procento} %
          </p>
          <p className="galerie-hlaska">{HLASKY[hlaska]}</p>
        </div>
      )}

      {chyba && <p className="galerie-chyba">{chyba}</p>}

      {mamNejake && (
        <div className="galerie-filtr">
          <button
            type="button"
            className={!jenMoje ? "aktivni" : ""}
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
                  <img src={nahledUrl(f.url, 600)} alt="Fotka od hosta" loading="lazy" />
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
            <video
              key={detail.id}
              src={detail.url.replace("/video/upload/", "/video/upload/q_auto/")}
              controls
              autoPlay
              playsInline
              className={nacitaVelkou ? "nacita" : ""}
              onLoadedData={() => setNacitaVelkou(false)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              key={detail.id}
              src={nahledUrl(detail.url, 1600)}
              alt="Fotka od hosta"
              className={nacitaVelkou ? "nacita" : ""}
              onLoad={() => setNacitaVelkou(false)}
            />
          )}
          {nacitaVelkou && <span className="galerie-nacitani" aria-hidden="true" />}
          {/* sousední fotky se stáhnou dopředu — listování je pak okamžité */}
          {predchozi && predchozi.id !== detail.id && !jeVideo(predchozi.url) && (
            <link rel="preload" as="image" href={nahledUrl(predchozi.url, 1600)} />
          )}
          {nasledujici && nasledujici.id !== detail.id && !jeVideo(nasledujici.url) && (
            <link rel="preload" as="image" href={nahledUrl(nasledujici.url, 1600)} />
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
            {detail.moje && (
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
