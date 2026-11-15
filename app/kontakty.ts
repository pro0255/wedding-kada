/* Na koho se obrátit v den svatby. Telefon ve tvaru +420…, bez mezer —
   tak funguje odkaz tel: i WhatsApp. TODO: doplnit skutečná čísla. */
export type Kontakt = { jmeno: string; role: string; tel: string };

export const KONTAKTY: Kontakt[] = [
  { jmeno: "Terezka", role: "svědkyně nevěsty", tel: "+420000000000" },
  { jmeno: "Vojta", role: "svědek ženicha", tel: "+420000000000" },
];

export const formatTel = (tel: string) =>
  tel.replace(/^\+420(\d{3})(\d{3})(\d{3})$/, "+420 $1 $2 $3");

/** Dokud je v seznamu jen zástupné číslo, odkaz tel:/WhatsApp se neukazuje. */
export const maTelefon = (k: Kontakt) => !/^\+4200+$/.test(k.tel);
