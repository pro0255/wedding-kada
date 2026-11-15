# Předlohy

Zdrojové obrázky, ze kterých `scripts/*.mjs` generují soubory pro web do `public/`,
a odložené varianty, které web zatím nepoužívá. Na web se nenasazují
(`.vercelignore`) — do `public/` patří jen to, co stránky opravdu načítají.

Struktura kopíruje `public/`: `predlohy/fotky/1.jpeg` → `public/fotky/web/1.webp`.
