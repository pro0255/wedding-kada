"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Galerie fotek od hostů. Hosté nemají účty — prohlížeč se pozná podle
 * náhodného id v localStorage, přes které fungují lajky, „moje fotky“
 * a mazání vlastních fotek.
 *
 * Upload jde z mobilu přímo do Cloudinary (unsigned preset), přes náš
 * server letí jen malá registrace do Airtable. Před uploadem se fotka
 * zmenší na canvasu — šetří data hostů i free tier.
 */
const DEVICE_KEY = "kj-device-id";
const MAX_STRANA = 2000;
const KVALITA = 0.85;
const OBNOVA_MS = 20_000;

type Fotka = {
  id: string;
  url: string;
  nahrano: string;
  lajky: number;
  lajklJsem: boolean;
  moje: boolean;
};

function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // soukromé okno — id nepřežije zavření, ale upload i lajky fungují
    return crypto.randomUUID();
  }
}

/** Cloudinary umí zmenšeniny přímo v URL — vložením transformace za /upload/. */
function nahledUrl(url: string, sirka: number): string {
  return url.replace("/image/upload/", `/image/upload/w_${sirka},c_limit,q_auto,f_auto/`);
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
  const [prubeh, setPrubeh] = useState<{ hotovo: number; celkem: number } | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [detail, setDetail] = useState<Fotka | null>(null);
  const device = useRef<string>("");

  useEffect(() => {
    device.current = deviceId();
  }, []);

  const nacti = useCallback(async () => {
    try {
      const odpoved = await fetch(`/api/fotky?device=${device.current}`);
      if (!odpoved.ok) return;
      const data = (await odpoved.json()) as { fotky: Fotka[] };
      setFotky(data.fotky);
    } catch {
      /* galerie zůstane, jak byla */
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

    for (let i = 0; i < celkem; i++) {
      setPrubeh({ hotovo: i, celkem });
      try {
        const data = new FormData();
        data.append("file", await zmensi(soubory[i]));
        data.append("upload_preset", preset);
        const odpoved = await fetch(
          `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
          { method: "POST", body: data }
        );
        if (!odpoved.ok) throw new Error(await odpoved.text());
        const { secure_url, public_id } = (await odpoved.json()) as {
          secure_url: string;
          public_id: string;
        };

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
    if (selhalo > 0) {
      setChyba(
        selhalo === celkem
          ? "Nahrání se nezdařilo. Zkontrolujte připojení a zkuste to znovu."
          : `${celkem - selhalo} z ${celkem} fotek se nahrálo, zbytek zkuste znovu.`
      );
    }
    nacti();
  }

  async function lajkni(fotka: Fotka) {
    // optimisticky — kdyby server neodpověděl, další obnova to srovná
    setFotky(
      (f) =>
        f?.map((x) =>
          x.id === fotka.id
            ? { ...x, lajklJsem: !x.lajklJsem, lajky: x.lajky + (x.lajklJsem ? -1 : 1) }
            : x
        ) ?? null
    );
    setDetail((d) =>
      d?.id === fotka.id
        ? { ...d, lajklJsem: !d.lajklJsem, lajky: d.lajky + (d.lajklJsem ? -1 : 1) }
        : d
    );
    try {
      await fetch("/api/fotky/lajk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotkaId: fotka.id, deviceId: device.current }),
      });
    } catch {
      /* srovná se při obnově */
    }
  }

  async function smaz(fotka: Fotka) {
    setFotky((f) => f?.filter((x) => x.id !== fotka.id) ?? null);
    setDetail(null);
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

  return (
    <div className="galerie-telo">
      <label className={`btn galerie-upload ${prubeh ? "galerie-upload-bezi" : ""}`}>
        {prubeh ? `Nahrávám ${prubeh.hotovo + 1} / ${prubeh.celkem}…` : "Nahrát fotky"}
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={!!prubeh}
          onChange={(e) => {
            nahraj(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

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

      {fotky === null ? (
        <p className="galerie-prazdna">Načítám galerii…</p>
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
                  onClick={() => setDetail(f)}
                  aria-label="Zobrazit fotku"
                >
                  <img src={nahledUrl(f.url, 600)} alt="Fotka od hosta" loading="lazy" />
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
        <div className="galerie-detail" onClick={() => setDetail(null)}>
          <img src={nahledUrl(detail.url, 1600)} alt="Fotka od hosta" />
          <div className="galerie-detail-listy" onClick={(e) => e.stopPropagation()}>
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
            <button type="button" className="galerie-zavrit" onClick={() => setDetail(null)}>
              Zavřít
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
