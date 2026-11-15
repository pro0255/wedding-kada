import type { HraSlug } from "@/lib/hra";

/* Skóre na slabém signálu: když odeslání selže, uloží se do localStorage
   a pošle se, až se vrátí signál (nebo při příští hře). Server si drží jen
   nejlepší výsledek zařízení (ZADD GT), takže opakované odeslání nevadí —
   a z čekajících stačí držet nejlepší skóre každé hry. */

const KLIC = "kj-skore-fronta";
type Cekajici = Partial<Record<HraSlug, { deviceId: string; skore: number }>>;

function nacti(): Cekajici {
  try {
    return JSON.parse(localStorage.getItem(KLIC) ?? "{}") as Cekajici;
  } catch {
    return {};
  }
}

function zapis(c: Cekajici) {
  try {
    if (Object.keys(c).length === 0) localStorage.removeItem(KLIC);
    else localStorage.setItem(KLIC, JSON.stringify(c));
  } catch {
    /* soukromé okno — skóre se aspoň zkusilo poslat */
  }
}

async function posli(hra: HraSlug, deviceId: string, skore: number): Promise<boolean> {
  try {
    const r = await fetch("/api/hra", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hra, deviceId, skore }),
    });
    // 4xx = neplatné skóre, opakovat nemá smysl; 5xx a síť ano
    return r.ok || (r.status >= 400 && r.status < 500);
  } catch {
    return false;
  }
}

/** Odešle skóre; při neúspěchu ho nechá čekat. */
export async function odesliSkore(hra: HraSlug, deviceId: string, skore: number): Promise<void> {
  if (await posli(hra, deviceId, skore)) return;
  const c = nacti();
  if (!c[hra] || c[hra]!.skore < skore) c[hra] = { deviceId, skore };
  zapis(c);
}

/** Pošle všechna čekající skóre (volá se při startu hry a po návratu signálu). */
export async function dorucCekajici(): Promise<void> {
  const c = nacti();
  for (const [hra, s] of Object.entries(c) as [HraSlug, { deviceId: string; skore: number }][]) {
    if (await posli(hra, s.deviceId, s.skore)) delete c[hra];
  }
  zapis(c);
}
