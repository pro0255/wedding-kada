"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CEKANI_NA_ODPOVED_MS,
  REGISTRACE_MS,
  ZALOHA_PO_POKUSECH,
  ZASEKNUTI_MS,
  cekatDo,
  pauzaPredPokusem,
  posudChybu,
  vyberDalsi,
} from "@/lib/frontaNahravani";

/**
 * Fronta nahrávání fotek a videí pro slabý signál.
 *
 * Host vybere soubory → fotky se zmenší → všechno se uloží do telefonu
 * (IndexedDB) → fronta je po jednom nahrává do Cloudinary a registruje
 * u nás. Při výpadku čeká na signál, zaseknutý přenos po 30 s přeruší,
 * chybu zkusí znovu s rostoucí pauzou. Soubor z fronty zmizí, až když je
 * v galerii — zavřená stránka nevadí, při příštím otevření galerie se
 * pokračuje. Pravidla (pauzy, co opakovat) jsou v lib/frontaNahravani.ts.
 *
 * Dvě otevřené záložky by nahrávaly totéž dvakrát; frontu proto drží
 * zámek (Web Locks), kde ho prohlížeč má.
 */

export const MAX_STRANA = 2000;
const KVALITA = 0.85;
/* Cloudinary free pustí video až do 100 MB, ale kredity (25 za 30 dní)
   nejrychleji pálí právě přehrávání videí. 50 MB je zhruba půlminutové
   video z telefonu — na svatební chvilku stačí. */
export const MAX_VIDEO_B = 50 * 1024 * 1024;

type Polozka = {
  id: string;
  soubor: Blob;
  deviceId: string;
  pridano: number;
  pokusy: number;
  dalsiPokus: number;
  /** Cloudinary už soubor má — při dalším pokusu stačí registrace u nás. */
  nahrano?: { url: string; publicId: string };
};

/* ---------- úložiště: IndexedDB, bez ní (soukromé okno) aspoň paměť ---------- */

const DB = "kj-nahravani";
const STORE = "fronta";
let dbSlib: Promise<IDBDatabase | null> | null = null;
const pamet = new Map<string, Polozka>();

function db(): Promise<IDBDatabase | null> {
  dbSlib ??= new Promise((vyres) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
      r.onsuccess = () => vyres(r.result);
      r.onerror = () => vyres(null);
    } catch {
      vyres(null);
    }
  });
  return dbSlib;
}

async function transakce<T>(rezim: IDBTransactionMode, prace: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  if (!d) throw new Error("bez IndexedDB");
  return new Promise((vyres, zamitni) => {
    const t = d.transaction(STORE, rezim);
    const r = prace(t.objectStore(STORE));
    t.oncomplete = () => vyres(r.result);
    t.onerror = () => zamitni(t.error);
    t.onabort = () => zamitni(t.error);
  });
}

async function vsechny(): Promise<Polozka[]> {
  try {
    return [...(await transakce("readonly", (s) => s.getAll() as IDBRequest<Polozka[]>)), ...pamet.values()];
  } catch {
    return [...pamet.values()];
  }
}

async function uloz(p: Polozka): Promise<void> {
  if (pamet.has(p.id)) return void pamet.set(p.id, p);
  try {
    await transakce("readwrite", (s) => s.put(p));
  } catch {
    pamet.set(p.id, p); // plné úložiště / soukromé okno — přežije aspoň do zavření stránky
  }
}

async function smaz(id: string): Promise<void> {
  pamet.delete(id);
  try {
    await transakce("readwrite", (s) => s.delete(id));
  } catch {
    /* v IndexedDB nebyla */
  }
}

/* ---------- příprava a odeslání jednoho souboru ---------- */

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
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", KVALITA));
    return blob ?? soubor;
  } catch {
    return soubor;
  } finally {
    URL.revokeObjectURL(objektUrl);
  }
}

class ChybaNahrani extends Error {
  constructor(readonly status: number) {
    super(`nahrání: ${status}`);
  }
}

/** Upload přes XHR (fetch neumí hlásit průběh). Hlídá zaseknutí: bez pohybu 30 s → přerušit. */
function doCloudinary(
  soubor: Blob,
  naPokrok: (podil: number) => void,
): Promise<{ url: string; publicId: string }> {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET;
  return new Promise((vyres, zamitni) => {
    if (!cloud || !preset) return zamitni(new ChybaNahrani(400));
    const xhr = new XMLHttpRequest();
    let hlidac = 0;
    const hlidej = (ms: number) => {
      window.clearTimeout(hlidac);
      hlidac = window.setTimeout(() => xhr.abort(), ms);
    };
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`);
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return hlidej(ZASEKNUTI_MS);
      naPokrok(e.loaded / e.total);
      hlidej(e.loaded >= e.total ? CEKANI_NA_ODPOVED_MS : ZASEKNUTI_MS);
    };
    xhr.onload = () => {
      window.clearTimeout(hlidac);
      if (xhr.status >= 300) return zamitni(new ChybaNahrani(xhr.status));
      try {
        const d = JSON.parse(xhr.responseText) as { secure_url: string; public_id: string };
        vyres({ url: d.secure_url, publicId: d.public_id });
      } catch {
        zamitni(new ChybaNahrani(0));
      }
    };
    xhr.onerror = xhr.onabort = xhr.ontimeout = () => {
      window.clearTimeout(hlidac);
      zamitni(new ChybaNahrani(0));
    };
    const data = new FormData();
    data.append("file", soubor);
    data.append("upload_preset", preset);
    hlidej(ZASEKNUTI_MS);
    xhr.send(data);
  });
}

async function registruj(p: Polozka): Promise<void> {
  const ovladac = new AbortController();
  const casovac = window.setTimeout(() => ovladac.abort(), REGISTRACE_MS);
  try {
    const r = await fetch("/api/fotky", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: p.nahrano!.url, publicId: p.nahrano!.publicId, deviceId: p.deviceId }),
      signal: ovladac.signal,
    });
    if (!r.ok) throw new ChybaNahrani(r.status);
  } catch (chyba) {
    throw chyba instanceof ChybaNahrani ? chyba : new ChybaNahrani(0);
  } finally {
    window.clearTimeout(casovac);
  }
}

/** Počká `ms`, nebo dřív, když se vrátí signál / host přidá další soubor. */
function pockej(ms: number, probud: { fn: () => void }): Promise<void> {
  return new Promise((vyres) => {
    const hotovo = () => {
      window.clearTimeout(t);
      window.removeEventListener("online", hotovo);
      vyres();
    };
    const t = window.setTimeout(hotovo, ms);
    window.addEventListener("online", hotovo);
    probud.fn = hotovo;
  });
}

/* ---------- hook pro galerii ---------- */

/** Jeden soubor tak, jak ho host vidí v panelu nahrávání. */
export type SouborUI = {
  id: string;
  /** object URL na soubor v telefonu — náhled ještě před nahráním */
  nahled: string;
  video: boolean;
  stav: "ceka" | "nahrava" | "hotovo" | "znovu";
  /** průběh nahrávání 0–100 (jen u stavu „nahrava“) */
  procento: number;
};

export type StavNahravani = {
  /** soubory téhle várky v pořadí výběru, včetně hotových */
  soubory: SouborUI[];
  /** null = jede; jinak proč fronta stojí */
  ceka: null | "signal" | "znovu";
  /** nahrávání opakovaně selhává — nabídnout zálohu (WhatsApp) */
  problem: boolean;
  /** celá várka je v galerii — panel ještě chvíli ukáže „Hotovo“ */
  hotovo: boolean;
};

const KLID: StavNahravani = { soubory: [], ceka: null, problem: false, hotovo: false };
/** jak dlouho po dokončení várky zůstane vidět „Hotovo“ */
const HOTOVO_MS = 5000;

export function useNahravani({
  deviceId,
  aktivni,
  poNahrani,
  zamceno,
  naChybu,
}: {
  deviceId: () => string;
  /** fronta běží jen pro toho, kdo prošel vstupem do galerie */
  aktivni: boolean;
  poNahrani: () => void;
  zamceno?: () => void;
  /** trvalé chyby (moc velké video, odmítnutý soubor) k zobrazení hostovi */
  naChybu: (zprava: string) => void;
}) {
  const [stav, setStav] = useState<StavNahravani>(KLID);
  const bezi = useRef(false);
  const probud = useRef({ fn: () => {} });
  const zpetne = useRef({ poNahrani, zamceno, naChybu });
  zpetne.current = { poNahrani, zamceno, naChybu };

  /* Panel: id → soubor. Hotové v něm zůstávají až do konce várky, ať host
     vidí, co už prošlo. Náhledy jsou object URL — uvolní se s várkou. */
  const ui = useRef(new Map<string, SouborUI & { pridano: number }>());
  const uklid = useRef(0);
  const vykresli = useCallback((zmena: Partial<Omit<StavNahravani, "soubory">> = {}) => {
    const soubory = [...ui.current.values()].sort((a, b) => a.pridano - b.pridano);
    setStav((s) => ({ ...s, ...zmena, soubory }));
  }, []);

  const zaradDoPanelu = useCallback((polozky: Polozka[]) => {
    window.clearTimeout(uklid.current);
    const ted = Date.now();
    for (const p of polozky) {
      const v = ui.current.get(p.id);
      const stav = p.dalsiPokus > ted ? "znovu" : "ceka";
      if (!v) {
        ui.current.set(p.id, {
          id: p.id,
          nahled: URL.createObjectURL(p.soubor),
          video: p.soubor.type.startsWith("video/"),
          stav,
          procento: 0,
          pridano: p.pridano,
        });
      } else if (v.stav !== "nahrava") {
        v.stav = stav;
      }
    }
  }, []);

  const dokonciVarku = useCallback(() => {
    if (ui.current.size === 0) return setStav(KLID);
    vykresli({ ceka: null, hotovo: true, problem: false });
    uklid.current = window.setTimeout(() => {
      for (const v of ui.current.values()) URL.revokeObjectURL(v.nahled);
      ui.current.clear();
      setStav(KLID);
    }, HOTOVO_MS);
  }, [vykresli]);

  const smycka = useCallback(async () => {
    for (;;) {
      const polozky = await vsechny();
      if (polozky.length === 0) return dokonciVarku();
      zaradDoPanelu(polozky);
      const problem = polozky.some((p) => p.pokusy >= ZALOHA_PO_POKUSECH);

      if (!navigator.onLine) {
        vykresli({ ceka: "signal", problem, hotovo: false });
        await pockej(20_000, probud.current);
        continue;
      }
      const p = vyberDalsi(polozky, Date.now());
      if (!p) {
        vykresli({ ceka: "znovu", problem, hotovo: false });
        await pockej(cekatDo(polozky, Date.now()), probud.current);
        continue;
      }

      const radek = ui.current.get(p.id)!;
      radek.stav = "nahrava";
      radek.procento = p.nahrano ? 99 : 0;
      vykresli({ ceka: null, problem, hotovo: false });
      try {
        if (!p.nahrano) {
          p.nahrano = await doCloudinary(p.soubor, (podil) => {
            radek.procento = Math.min(99, Math.round(podil * 100));
            vykresli();
          });
          await uloz(p); // příště už jen registrace, soubor znovu neposílat
        }
        await registruj(p);
        await smaz(p.id);
        radek.stav = "hotovo";
        radek.procento = 100;
        vykresli();
        zpetne.current.poNahrani();
      } catch (chyba) {
        const status = chyba instanceof ChybaNahrani ? chyba.status : 0;
        const verdikt = posudChybu(status);
        if (verdikt === "zamceno") {
          zpetne.current.zamceno?.();
          radek.stav = "znovu";
          vykresli({ ceka: "znovu" });
          return; // soubory zůstávají ve frontě, pokračuje se po novém vstupu
        }
        if (verdikt === "vzdat") {
          await smaz(p.id);
          URL.revokeObjectURL(radek.nahled);
          ui.current.delete(p.id);
          zpetne.current.naChybu("Jeden soubor se nahrát nepodařilo — zkuste ho prosím poslat jinak.");
          continue;
        }
        radek.stav = "znovu";
        p.pokusy++;
        p.dalsiPokus = Date.now() + pauzaPredPokusem(p.pokusy);
        await uloz(p);
      }
    }
  }, [dokonciVarku, vykresli, zaradDoPanelu]);

  const spust = useCallback(() => {
    if (bezi.current) return probud.current.fn();
    bezi.current = true;
    const hotovo = () => {
      bezi.current = false;
    };
    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (locks) {
      // ifAvailable: frontu už nahrává jiná záložka — tahle ji nechá být
      locks
        .request("kj-nahravani", { ifAvailable: true }, async (zamek) => {
          if (zamek) await smycka();
        })
        .catch(() => {})
        .finally(hotovo);
    } else {
      smycka().catch(() => {}).finally(hotovo);
    }
  }, [smycka]);

  // po vstupu do galerie dokončit, co zůstalo z minula; při návratu signálu / do záložky pokračovat
  useEffect(() => {
    if (!aktivni) return;
    spust();
    const znovu = () => document.visibilityState === "visible" && spust();
    window.addEventListener("online", spust);
    document.addEventListener("visibilitychange", znovu);
    return () => {
      window.removeEventListener("online", spust);
      document.removeEventListener("visibilitychange", znovu);
    };
  }, [aktivni, spust]);

  /** Přidá vybrané soubory do fronty. Fotky se nejdřív zmenší (šetří data i úložiště). */
  const pridej = useCallback(
    async (soubory: File[]) => {
      let prilisVelke = 0;
      let poradi = 0;
      for (const soubor of soubory) {
        const video = soubor.type.startsWith("video/");
        if (video && soubor.size > MAX_VIDEO_B) {
          prilisVelke++;
          continue;
        }
        const p: Polozka = {
          id: crypto.randomUUID(),
          soubor: video ? soubor : await zmensi(soubor),
          deviceId: deviceId(),
          pridano: Date.now() + poradi++, // pořadí výběru i při stejné milisekundě
          pokusy: 0,
          dalsiPokus: 0,
        };
        await uloz(p);
        // do panelu hned, ať host vidí výběr ještě před prvním bajtem
        zaradDoPanelu([p]);
        vykresli({ hotovo: false });
        spust();
      }
      if (prilisVelke > 0) {
        zpetne.current.naChybu(
          prilisVelke === 1
            ? "Jedno video je příliš velké (max. 50 MB, zhruba půl minuty)."
            : prilisVelke < 5
              ? `${prilisVelke} videa jsou příliš velká (max. 50 MB, zhruba půl minuty).`
              : `${prilisVelke} videí je příliš velkých (max. 50 MB, zhruba půl minuty).`,
        );
      }
    },
    [deviceId, spust, vykresli, zaradDoPanelu],
  );

  /** Odebere soubor, který ještě nezačal nahrávat (host si to rozmyslel). */
  const odeber = useCallback(
    async (id: string) => {
      const v = ui.current.get(id);
      if (!v || v.stav === "nahrava" || v.stav === "hotovo") return;
      await smaz(id);
      URL.revokeObjectURL(v.nahled);
      ui.current.delete(id);
      if ([...ui.current.values()].every((x) => x.stav === "hotovo")) dokonciVarku();
      else vykresli();
    },
    [dokonciVarku, vykresli],
  );

  return { stav, pridej, odeber };
}
