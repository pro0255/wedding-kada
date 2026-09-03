/**
 * Klíčové okamžiky svatby na jednom místě. Zapsané výslovně s posunem
 * +02:00, ne dopočtem přes setHours — u hosta v jiném pásmu by to spadlo
 * na jiný den.
 */
export const SVATEBNI_DEN = new Date("2027-09-18T00:00:00+02:00");
export const OBRAD = new Date("2027-09-18T12:00:00+02:00");

/** Od kdy web přepnout na poděkování: ráno po svatbě, ať noc dojede v klidu. */
export const PO_SVATBE_OD = new Date("2027-09-19T08:00:00+02:00");

export function poSvatbe(ted: Date = new Date()): boolean {
  return ted.getTime() >= PO_SVATBE_OD.getTime();
}
