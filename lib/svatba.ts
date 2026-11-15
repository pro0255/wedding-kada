/**
 * Od kdy web přepnout na poděkování: ráno po svatbě, ať noc dojede v klidu.
 * Zapsané výslovně s posunem +02:00, ne dopočtem přes setHours — u hosta
 * v jiném pásmu by to spadlo na jiný den.
 */
const PO_SVATBE_OD = new Date("2027-09-19T08:00:00+02:00");

export function poSvatbe(ted: Date = new Date()): boolean {
  return ted.getTime() >= PO_SVATBE_OD.getTime();
}
