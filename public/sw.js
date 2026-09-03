/* Service worker — offline záloha pro den svatby (slabý signál v Rekovicích).
   Strategie:
   - navigace (HTML): síť, při výpadku poslední uložená stránka
   - statika Next (/_next/static), fonty, obrázky, ikony: uložená kopie se
     vrátí hned a na pozadí se stáhne čerstvá pro příště (stale-while-revalidate)
   - /api/*: nikdy necachovat (kapacita ubytování, upload fotek)
   VERZE měňte při změně strategie, ne při každém deploy — obsah se obnovuje sám. */
const VERZE = "svatba-v2";
const PREDEM = ["/", "/manifest.webmanifest", "/ikony/ikona-192.png", "/ikony/ikona-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(VERZE)
      .then((c) => c.addAll(PREDEM))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((klice) => Promise.all(klice.filter((k) => k !== VERZE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const jeStatika = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/fotky/") ||
  url.pathname.startsWith("/ikony/") ||
  /\.(png|jpe?g|webp|svg|woff2?|ttf|css|js|mjs)$/.test(url.pathname);

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // mapové dlaždice, fonty Google apod. necháme být
  if (url.pathname.startsWith("/api/")) return;

  // HTML: síť první, offline poslední známá verze (nebo úvodní stránka)
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((odpoved) => {
          const kopie = odpoved.clone();
          caches.open(VERZE).then((c) => c.put(request, kopie));
          return odpoved;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/"))),
    );
    return;
  }

  /* Statika: uložená kopie se vrátí hned, ale VŽDY se na pozadí stáhne
     čerstvá a přepíše cache pro příští načtení.

     Dřív se tu při zásahu do cache na síť už vůbec nesáhlo. Soubory
     z /_next/static to snesou, protože mají hash v názvu a po každém buildu
     se jmenují jinak — jenže obrázky v /fotky/ se jmenují pořád stejně, takže
     komu se jednou uložily, tomu tam zůstaly navždycky. Po výměně podkladu
     pruhu tak host viděl novou stránku se starým obrázkem. */
  if (jeStatika(url)) {
    e.respondWith(
      caches.open(VERZE).then(async (c) => {
        const ulozeno = await c.match(request);
        const ze_site = fetch(request)
          .then((odpoved) => {
            if (odpoved.ok) c.put(request, odpoved.clone());
            return odpoved;
          })
          .catch(() => ulozeno);
        return ulozeno || ze_site;
      }),
    );
  }
});
