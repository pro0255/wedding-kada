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
