import type { HraSlug } from "@/lib/hra";
import type { Hra, Rozmer } from "./typy";
import { zenich } from "./zenich";
import { husky } from "./husky";
import { prsten } from "./prsten";

/* Registr her podle slugu. Stav je pro obal neprůhledný objekt. */
export const HRY_REGISTR: Record<HraSlug, Hra<Rozmer>> = { zenich, husky, prsten };
