import { KLIC, redis } from "./redis.ts";

/**
 * Jméno k zařízení. Jeden záznam na deviceId v hashi — může ho použít
 * kterákoli část webu, kde chceme hosta oslovit bez přihlašování.
 */
export async function jmenoHosta(deviceId: string): Promise<string | null> {
  // Upstash hodnoty parsuje jako JSON — jméno „42“ by přišlo jako číslo
  const jmeno = await redis().hget<unknown>(KLIC.hoste, deviceId);
  return jmeno == null ? null : String(jmeno);
}

/** Všechna jména naráz (pro žebříčky). */
export async function vsechnaJmena(): Promise<Map<string, string>> {
  const vse = (await redis().hgetall<Record<string, unknown>>(KLIC.hoste)) ?? {};
  return new Map(Object.entries(vse).map(([d, j]) => [d, String(j)]));
}

export async function ulozJmeno(deviceId: string, jmeno: string): Promise<void> {
  await redis().hset(KLIC.hoste, { [deviceId]: jmeno });
}
