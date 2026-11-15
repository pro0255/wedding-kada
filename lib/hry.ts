/* Seznam her bez závislosti na zodu — klientské komponenty ho berou odsud,
   aby si do bundlu nepřitáhly celý zod. Schéma nad ním je v schemata.ts. */
export const HRY = ["zenich", "husky", "prsten"] as const;
export type HraSlug = (typeof HRY)[number];
