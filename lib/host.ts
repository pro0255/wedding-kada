import { apiTabulky, doFormule, nactiZaznamy, upravZaznam, vlozZaznam } from "./airtable.ts";

/**
 * Jméno k zařízení. Jeden řádek na deviceId (upsert) — může ho použít
 * kterákoli část webu, kde chceme hosta oslovit bez přihlašování.
 */
const API_HOSTE = apiTabulky("Hoste");
type HostFields = { DeviceId?: string; "Jméno"?: string; "Změněno"?: string };

async function najdi(deviceId: string) {
  const z = await nactiZaznamy<HostFields>(API_HOSTE, `{DeviceId}='${doFormule(deviceId)}'`);
  return z[0];
}

export async function jmenoHosta(deviceId: string): Promise<string | null> {
  return (await najdi(deviceId))?.fields["Jméno"] ?? null;
}

export async function ulozJmeno(deviceId: string, jmeno: string): Promise<void> {
  const fields: HostFields = { "Jméno": jmeno, "Změněno": new Date().toISOString() };
  const existujici = await najdi(deviceId);
  if (existujici) await upravZaznam<HostFields>(API_HOSTE, existujici.id, fields);
  else await vlozZaznam<HostFields>(API_HOSTE, { DeviceId: deviceId, ...fields });
}
