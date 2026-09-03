# Knihovna her + žebříčky (Airtable)

Stav: návrh, 2026-09-03.

## Cíl
Svatební web dostane sekci `/hry` se třemi jednoduchými 2D hrami. Každá hra má
veřejný žebříček. Stránka 404 nese první hru inline a odkazuje na `/hry`.
Hosté nemají účty; zařízení se pozná podle `kj-device-id` v localStorage
(už používá galerie fotek). Host si může vyplnit jméno — uloží se k deviceId
do Airtable a bude použitelné i jinde na webu.

## Hry
1. **Ženich běží k oltáři** (`zenich`) — dino klon, hotovo v `app/Hra404.tsx`.
   Skok mezerník / ↑ / tap. Skóre = metry.
2. **Husky chytá prstýnky** (`husky`) — pes dole, ovládání ←→ / tah prstem po
   plátně (pes sleduje x prstu). Padají prstýnky (+1), kytice (+5), tchýně
   (−1 život ze 3). Rychlost roste s časem. Skóre = body.
3. **Flappy prsten** (`prsten`) — Jeden prsten letí mezi dvojicemi svíček,
   tap / mezerník = mávnutí. Skóre = prošlé svíčky.

Společné: pixel-art sprity jako string mapy, jedno logické plátno škálované
CSS, `requestAnimationFrame` + delta-time, barvy z CSS proměnných webu
(`--ink`, `--accent`, `--bg-alt`). Stavy `start → hra → konec`. Po konci se
skóre pošle na server (`POST /api/hra`), lokální rekord v localStorage
`kj-<hra>-rekord`.

Mobil: `touch-action: none` na plátně, `pointerdown/move` místo myši,
plátno na celou šířku, ovládací nápověda podle `pointer: coarse`.

## Struktura souborů
```
app/hry/page.tsx               knihovna: 3 karty (název, pixel ikona, nejlepší skóre)
app/hry/[hra]/page.tsx         hra + žebříček + pole na jméno
app/hry/hry.module.css
app/hry/Hra.tsx                obal: vybere hru podle slugu, řídí start/konec, posílá skóre
app/hry/hry/zenich.ts          logika + kresba (přesun z Hra404.tsx)
app/hry/hry/husky.ts
app/hry/hry/prsten.ts
app/hry/hry/sprity.ts          sdílené sprity + kresli()
app/hry/Zebricek.tsx           top 10, polling 30 s, zvýrazní moje zařízení
app/hry/Jmeno.tsx              pole „Tvoje jméno“, uloží do Hoste + kj-jmeno
app/not-found.tsx              text + <Hra hra="zenich" /> + odkaz „Další hry“
app/api/hra/route.ts           GET ?hra= → žebříček; POST {hra, deviceId, skore}
app/api/host/route.ts          GET ?device= → jméno; POST {deviceId, jmeno}
lib/airtable.ts                hlavicky(), nactiZaznamy(), vlozZaznam(), upravZaznam()
lib/hra.ts                     zebricek(hra), ulozSkore()
lib/host.ts                    jmenoHosta(), ulozJmeno() (upsert podle DeviceId)
lib/deviceId.ts                klientský helper (vyseknut z FotoGalerie.tsx)
```
Rozhraní hry (`app/hry/hry/*.ts`):
```ts
type Hra = {
  slug: "zenich" | "husky" | "prsten";
  nazev: string; popis: string; napoveda: { mys: string; dotyk: string };
  W: number; H: number;              // logické plátno
  start(ctx, barvy): Stav;           // vytvoří stav
  vstup(stav, e: Vstup): void;       // {typ:"tap"|"klavesa"|"pohyb", x?, klavesa?}
  krok(stav, dt): { konec?: boolean; skore: number };
  vykresli(ctx, stav): void;
};
```

## Airtable (base `appw1s9BtzlKCPous`)
- `Hoste`: `DeviceId` (text, primární), `Jméno` (text), `Změněno` (dateTime).
  Jeden řádek na zařízení (upsert).
- `Skore`: `DeviceId` (text, primární), `Hra` (singleSelect zenich/husky/prsten),
  `Skóre` (number 0), `Kdy` (dateTime). Každé dohrání = řádek.
- Žebříček: GET načte `Skore` filtrované na hru + `Hoste`, na serveru
  nejlepší skóre na DeviceId, seřadí, vezme top 10, doplní jména („Neznámý
  host“). Odpověď obsahuje i moje pořadí (dle `?device=`).
- Validace: deviceId `^[a-f0-9-]{16,64}$`, skóre celé 0–100000, jméno
  1–30 znaků, oříznuté, bez řídicích znaků. Chyby → JSON `{chyba}` + 400/502,
  stejně jako `app/api/fotky`.
- Cache: žádná na serveru (`no-store`), klient polluje 30 s jen když je
  stránka viditelná.

## Testování
- `npx tsc --noEmit`, `next build`.
- Ruční: každá hra na :3001 desktop + mobilní šířka (headless Chrome
  screenshot), dohrání → řádek v `Skore`, jméno → řádek v `Hoste`,
  žebříček se přepočte.
- Airtable skript ve scratchpadu na výpis/smazání testovacích řádků.

## Mimo rozsah
Účty, anti-cheat nad rámec validace, zvuk, animace přechodů mezi hrami.
