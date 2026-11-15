import { z } from "zod";

/**
 * Zod schémata pro všechno, co přichází z klienta. Route handlery parsují
 * jen přes ně — ručně psané `typeof` kontroly sem nepatří.
 */
export const HRY = ["zenich", "husky", "prsten"] as const;
export const HraSchema = z.enum(HRY);
export type HraSlug = z.infer<typeof HraSchema>;

/** Náš vygenerovaný uuid z localStorage — nic jiného nepouštíme dál. */
export const DeviceIdSchema = z.string().regex(/^[a-f0-9-]{16,64}$/i);

export const SkoreSchema = z.number().int().min(0).max(100000);

/** 1–30 znaků po oříznutí, bez řídicích a formátovacích znaků. */
export const JmenoSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .refine((t) => !/\p{C}/u.test(t), "Jméno obsahuje nepovolené znaky.");

export const SkorePostSchema = z.object({
  hra: HraSchema,
  deviceId: DeviceIdSchema,
  skore: SkoreSchema,
});

export const HostPostSchema = z.object({
  deviceId: DeviceIdSchema,
  jmeno: JmenoSchema,
});

export const ZebricekDotazSchema = z.object({
  hra: HraSchema,
  device: DeviceIdSchema.optional(),
});

/** Id fotky — tvar z dob Airtable (rec + 14 znaků), nové se generují stejně. */
export const FotkaIdSchema = z.string().regex(/^rec[A-Za-z0-9]{14}$/);

/** Bereme jen URL z našeho Cloudinary účtu — ať nám do galerie nikdo nepodstrčí cizí obsah. */
const CloudinaryUrlSchema = z.string().refine((url) => {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  return (
    !!cloud &&
    (url.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`) ||
      url.startsWith(`https://res.cloudinary.com/${cloud}/video/upload/`))
  );
});

export const FotkaPostSchema = z.object({
  url: CloudinaryUrlSchema,
  publicId: z.string().max(300),
  deviceId: DeviceIdSchema,
});

export const FotkaDeleteSchema = z.object({ id: FotkaIdSchema, deviceId: DeviceIdSchema });

export const LajkPostSchema = z.object({ fotkaId: FotkaIdSchema, deviceId: DeviceIdSchema });

/** Odpověď na otázku u vstupu do galerie fotek. deviceId je jen pro limit
 *  pokusů na zařízení — starší klient ho neposílá, pak platí jen limit IP. */
export const VstupPostSchema = z.object({
  odpoved: z.string().trim().min(1).max(60),
  deviceId: DeviceIdSchema.optional(),
});

/** Kam se po přihlášení v /admin vrátit. Jen cesta na tomhle webu —
 *  „//jiny.web“ nebo „https://…“ by z přihlášení udělalo přesměrování ven. */
export const AdminDalSchema = z.string().regex(/^\/(?![\/\\])/);

export const MAX_OSOB_UBYTOVANI = 10;
const NEPLATNY = "Neplatný požadavek.";
const BEZ_JMENA = "Vyplňte prosím jméno a příjmení.";
const SPATNY_POCET = `Zadejte počet osob od 1 do ${MAX_OSOB_UBYTOVANI}.`;

/** Rezervace ubytování z formuláře. Hláška první chyby jde rovnou hostovi,
 *  pořadí klíčů proto určuje, co uvidí: nejdřív past na roboty, pak jméno, pak počet. */
export const RezervacePostSchema = z.object(
  {
    // skrytá past na roboty — člověk toto pole nevyplní
    web: z.string({ error: NEPLATNY }).trim().max(0, NEPLATNY).optional(),
    jmeno: z
      .string({ error: BEZ_JMENA })
      .transform((t) => t.trim().replace(/\s+/g, " "))
      .pipe(z.string().min(3, BEZ_JMENA).max(80, BEZ_JMENA)),
    // formulář posílá číslo, starší klient mohl poslat text
    pocet: z.coerce
      .number({ error: SPATNY_POCET })
      .int(SPATNY_POCET)
      .min(1, SPATNY_POCET)
      .max(MAX_OSOB_UBYTOVANI, SPATNY_POCET),
  },
  { error: NEPLATNY },
);

/* Stav kapacity ubytování, jak ho vrací /api/ubytovani. Klient si odpověď
   ověřuje: když API selže, vrací chybový objekt se stejným stavovým kódem,
   a bez kontroly se z něj v rozhraní stalo „volných míst: undefined“. */
export const UbytovaniStavSchema = z.object({
  obsazeno: z.number().int().min(0),
  celkem: z.number().int().min(0),
  volno: z.number().int().min(0),
});
