/* Service worker — offline záloha pro den svatby (slabý signál v Rekovicích).
   Strategie:
   - navigace (HTML): síť, při výpadku poslední uložená stránka
   - statika Next (/_next/static), fonty, obrázky, ikony: cache-first,
     na pozadí se doplňuje — soubory z /_next/static mají hash v názvu
   - /api/*: nikdy necachovat (kapacita ubytování, upload fotek)
   VERZE měňte při změně strategie, ne při každém deploy — obsah se obnovuje sám. */
const VERZE = "svatba-v1";
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

  // statika: cache první, síť doplní
  if (jeStatika(url)) {
    e.respondWith(
      caches.match(request).then(
        (ulozeno) =>
          ulozeno ||
          fetch(request).then((odpoved) => {
            if (odpoved.ok) {
              const kopie = odpoved.clone();
              caches.open(VERZE).then((c) => c.put(request, kopie));
            }
            return odpoved;
          }),
      ),
    );
  }
});
