/* Na koho se obrátit v den svatby. Telefon ve tvaru +420…, bez mezer —
   tak funguje odkaz tel: i WhatsApp. TODO: doplnit skutečná čísla. */
export type Kontakt = { jmeno: string; role: string; tel: string };

export const KONTAKTY: Kontakt[] = [
  { jmeno: "Jméno svědkyně", role: "svědkyně nevěsty", tel: "+420000000000" },
  { jmeno: "Jméno svědka", role: "svědek ženicha", tel: "+420000000000" },
];

export const formatTel = (tel: string) =>
  tel.replace(/^\+420(\d{3})(\d{3})(\d{3})$/, "+420 $1 $2 $3");
