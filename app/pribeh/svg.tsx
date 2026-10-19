/* SVG díly obálky s příběhem: definice (zrno papíru, podšívka, přechody)
   a tvary ve viewBoxu 160 × 100 (obálka 1.6 : 1).
   Textura papíru: ambientCG „Paper002“ (CC0, https://ambientcg.com/view?id=Paper002). */
/* Společné SVG definice: zrno papíru, podšívka se zlatými tečkami. */
export function Defs({ p }: { p: string }) {
  return (
    <defs>
      <pattern id={`${p}zrno`} patternUnits="userSpaceOnUse" width="40" height="52">
        <image href="/obalka/papir.webp" width="40" height="52" preserveAspectRatio="none" />
      </pattern>
      <pattern id={`${p}podsivka`} patternUnits="userSpaceOnUse" width="7" height="7">
        <rect width="7" height="7" fill="#f4ede0" />
        <circle cx="1.75" cy="1.75" r="0.55" fill="#c7a564" opacity="0.7" />
        <circle cx="5.25" cy="5.25" r="0.55" fill="#9fb3c6" opacity="0.6" />
      </pattern>
      <linearGradient id={`${p}chlopen`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#bccddc" />
        <stop offset="1" stopColor="#c9d8e5" />
      </linearGradient>
      <linearGradient id={`${p}spodek`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#c3d3e1" />
        <stop offset="1" stopColor="#b6c8d8" />
      </linearGradient>
      <linearGradient id={`${p}bokL`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#b4c6d6" />
        <stop offset="1" stopColor="#a9bccd" />
      </linearGradient>
      <linearGradient id={`${p}bokP`} x1="1" y1="0" x2="0" y2="0">
        <stop offset="0" stopColor="#b4c6d6" />
        <stop offset="1" stopColor="#a9bccd" />
      </linearGradient>
      <linearGradient id={`${p}zadek`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#a9b9c8" />
        <stop offset="0.55" stopColor="#bccad7" />
      </linearGradient>
    </defs>
  );
}

/* Zrno přes tvar: šedý šum v soft-light je kolem 50 % šedi neutrální,
   takže jen „zdrsní“ barvu, neztmaví ji. Rasterizuje se jednou s vrstvou. */
export function Zrno({ p, d }: { p: string; d: string }) {
  return <path d={d} fill={`url(#${p}zrno)`} style={{ mixBlendMode: "soft-light", opacity: 0.55 }} />;
}

// tvary ve viewBoxu 160 × 100 (obálka 1.6 : 1)
export const BOK_L = "M0,1 L74,52 Q78,55 74,58 L0,99 Z";
export const BOK_P = "M160,1 L86,52 Q82,55 86,58 L160,99 Z";
export const SPODEK = "M0,100 L73,49 Q80,44 87,49 L160,100 Z";
// chlopeň ve viewBoxu 160 × 58 (pant nahoře), špička zakulacená
export const CHLOPEN = "M0,0 L160,0 L88,52 Q80,58 72,52 Z";
// rub chlopně je vzhůru nohama (po otočení o 180° míří špička nahoru)
export const CHLOPEN_RUB = "M0,58 L160,58 L88,6 Q80,0 72,6 Z";
export const CHLOPEN_RUB_PODSIVKA = "M12,55 L148,55 L86,10 Q80,5 74,10 Z";

