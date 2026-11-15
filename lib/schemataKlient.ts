import * as z from "zod/mini";

/* Schémata, která běží v prohlížeči. Jsou psaná přes zod/mini: plný zod
   přidával do bundlu úvodní stránky ~85 kB (gzip), mini jen to, co se použije.
   Serverová schémata zůstávají v schemata.ts. */

const pocet = z.int().check(z.minimum(0));

/* Stav kapacity ubytování, jak ho vrací /api/ubytovani. Klient si odpověď
   ověřuje: když API selže, vrací chybový objekt se stejným stavovým kódem,
   a bez kontroly se z něj v rozhraní stalo „volných míst: undefined“. */
export const UbytovaniStavSchema = z.object({ obsazeno: pocet, celkem: pocet, volno: pocet });
