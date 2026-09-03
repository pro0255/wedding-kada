/**
 * Hosté nemají účty. Každý prohlížeč se pozná podle náhodného uuid v
 * localStorage — přes něj se párují fotky, lajky, skóre ve hrách i jméno.
 * Volat jen na klientovi (useEffect / handler).
 */
export const DEVICE_KEY = "kj-device-id";

export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // soukromé okno — id nepřežije zavření, ale všechno funguje
    return crypto.randomUUID();
  }
}
