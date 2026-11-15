/* Service worker — web pro slabý signál v Rekovicích.

   Strategie:
   - stránky (HTML): síť, ale nejdéle 3,5 s — pak uložená verze a čerstvá se
     na pozadí dotáhne pro příště. Úplně offline vždy uložená verze.
     Dřív se na síť čekalo bez limitu a na mizerném signálu host minutu
     koukal na bílou obrazovku, i když měl stránku v telefonu.
   - předem uložené stránky: hlavní stránka, fotky, hry i poděkování, a to
     i s JS a CSS, které potřebují — fungují offline, i když je host ještě
     neotevřel. Stahuje se až po instalaci a na pozadí, nebrzdí první návštěvu.
   - statika Next (/_next/static): hash v názvu, uložená kopie platí navždy
   - naše obrázky, fonty, ikony: uložená kopie hned, čerstvá na pozadí
   - náhledy fotek z Cloudinary: uložené napořád (adresa obsahuje verzi
     souboru), max NAHLEDY_MAX kusů — galerie je rychlejší, offline vidět
     a ušetří kredity Cloudinary. Videa ne (velká, přehrávají se po kouskách).
   - /api/*: nikdy (živá data, upload). Galerie si poslední seznam drží sama.
   - stránky jen pro správce (/admin, /navrh, /oznameni) se neukládají vůbec —
     nemají zůstat v telefonu.

   VERZE měňte při změně strategie, ne při každém deploy — obsah se obnovuje sám. */
const VERZE = "svatba-v4";
const NAHLEDY = "svatba-nahledy-v1";
const NAHLEDY_MAX = 600;
const SIT_MS = 3500;

const ZAKLAD = ["/manifest.webmanifest", "/ikony/ikona-192.png", "/ikony/ikona-512.png"];
const STRANKY = ["/", "/fotky", "/hry", "/hry/zenich", "/hry/husky", "/hry/prsten", "/podekovani"];
const SOUKROME = ["/admin", "/navrh", "/oznameni"];

const jeSoukroma = (cesta) => SOUKROME.some((s) => cesta === s || cesta.startsWith(s + "/"));

/* Uložit jen obyčejnou úspěšnou odpověď. Přesměrování (po svatbě vede „/“
   na /podekovani) ne: prohlížeč pak uloženou odpověď na přesměrování odmítne
   zobrazit a offline by místo stránky byla chyba. */
const lzeUlozit = (odpoved) => odpoved.ok && !odpoved.redirected && odpoved.type === "basic";

/** Stáhne stránku a všechny /_next/static soubory, které její HTML zmiňuje. */
async function ulozStrankuSeVsim(cache, cesta) {
  const odpoved = await fetch(cesta, { cache: "no-cache" });
  if (!lzeUlozit(odpoved)) return;
  const html = await odpoved.clone().text();
  await cache.put(cesta, odpoved);
  const statika = [...new Set(html.match(/\/_next\/static\/[^"'\s\\)]+/g) ?? [])];
  await Promise.allSettled(
    statika.map(async (u) => {
      if (await cache.match(u)) return;
      const r = await fetch(u);
      if (r.ok) await cache.put(u, r);
    }),
  );
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERZE)
      .then((c) => c.addAll(ZAKLAD))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((klice) => Promise.all(klice.filter((k) => k !== VERZE && k !== NAHLEDY).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      // stránky na pozadí, každá zvlášť — výpadek jedné nezastaví ostatní
      .then(() => caches.open(VERZE))
      .then((c) => Promise.allSettled(STRANKY.map((s) => ulozStrankuSeVsim(c, s)))),
  );
});

const jeStatika = (url) =>
  url.pathname.startsWith("/fotky/") ||
  url.pathname.startsWith("/ikony/") ||
  /\.(png|jpe?g|webp|svg|woff2?|ttf|css|js|mjs)$/.test(url.pathname);

// náhledy (zmenšeniny) z Cloudinary — poznají se podle transformace za /upload/
const jeNahled = (url) =>
  url.hostname === "res.cloudinary.com" && /\/(image|video)\/upload\/[^/]*w_\d+/.test(url.pathname) && !/\.(mp4|mov|webm)$/i.test(url.pathname);

async function prorezNahledy(cache) {
  const klice = await cache.keys();
  // Cache API vrací klíče v pořadí vložení — pryč s nejstaršími
  for (const k of klice.slice(0, Math.max(0, klice.length - NAHLEDY_MAX))) await cache.delete(k);
}

/** HTML: síť do SIT_MS, jinak uložená verze; síť se na pozadí dokončí a uloží. */
function stranka(e, url) {
  const zeSite = fetch(e.request).then((odpoved) => {
    if (lzeUlozit(odpoved)) {
      const kopie = odpoved.clone();
      e.waitUntil(caches.open(VERZE).then((c) => c.put(url.pathname + url.search, kopie)));
    }
    return odpoved;
  });
  e.waitUntil(zeSite.catch(() => {}));

  e.respondWith(
    (async () => {
      const ulozena =
        (await caches.match(url.pathname + url.search)) ||
        (await caches.match(url.pathname)) ||
        null;
      if (!ulozena) {
        // nic uloženého — čekat na síť; offline aspoň hlavní stránka / poděkování
        return zeSite.catch(async () => (await caches.match("/")) || (await caches.match("/podekovani")) || Response.error());
      }
      const casovac = new Promise((r) => setTimeout(() => r(null), SIT_MS));
      return (await Promise.race([zeSite.catch(() => null), casovac])) || ulozena;
    })(),
  );
}

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (jeNahled(url)) {
    e.respondWith(
      caches.open(NAHLEDY).then(async (c) => {
        const ulozeno = await c.match(request);
        if (ulozeno) return ulozeno;
        const odpoved = await fetch(request);
        // jen CORS odpověď (img s crossOrigin) — neprůhledná by zabrala megabajty místa
        if (odpoved.ok && odpoved.type === "cors") {
          await c.put(request, odpoved.clone());
          e.waitUntil(prorezNahledy(c));
        }
        return odpoved;
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return; // mapové dlaždice apod. necháme být
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    if (jeSoukroma(url.pathname)) return; // jen síť, nic neukládat
    stranka(e, url);
    return;
  }

  /* Hashované soubory Next se po buildu jmenují jinak, obsah pod stejným
     jménem se nikdy nezmění — revalidace by jen při každé návštěvě znovu
     stahovala celý JS. */
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.open(VERZE).then(async (c) => {
        const ulozeno = await c.match(request);
        if (ulozeno) return ulozeno;
        const odpoved = await fetch(request);
        if (odpoved.ok) c.put(request, odpoved.clone());
        return odpoved;
      }),
    );
    return;
  }

  /* Ostatní statika: uložená kopie hned, ale VŽDY se na pozadí stáhne
     čerstvá. Obrázky v /fotky/ se jmenují pořád stejně — bez revalidace by
     komu se jednou uložily, tomu by tam zůstaly navždycky. */
  if (jeStatika(url)) {
    e.respondWith(
      caches.open(VERZE).then(async (c) => {
        const ulozeno = await c.match(request);
        const zeSite = fetch(request)
          .then((odpoved) => {
            if (odpoved.ok) c.put(request, odpoved.clone());
            return odpoved;
          })
          .catch(() => ulozeno);
        if (ulozeno) e.waitUntil(zeSite);
        return ulozeno || zeSite;
      }),
    );
  }
});
