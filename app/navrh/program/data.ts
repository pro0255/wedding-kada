/* Program dne pro návrhy — kopie dat z app/page.tsx (návrhy se necommitují,
   naostro se data jen přesunou). */
export type Bod = { cas: string; nazev: string; ikona: string; misto?: string; popis: string };

export const PROGRAM: Bod[] = [
  { cas: "9:00", nazev: "Snídaně", ikona: "snidane", misto: "U ženicha a nevěsty",
    popis: "Poslední klidné sousto předtím, než to celé začne." },
  { cas: "12:00", nazev: "Obřad", ikona: "obrad", misto: "U zvoničky v Rekovicích",
    popis: "Tady si řekneme své „ano“. Kapesníčky doporučujeme mít po ruce." },
  { cas: "13:30", nazev: "Přípitek a svatební oběd", ikona: "obed",
    popis: "Na zdraví, na lásku a na pořádný hlad." },
  { cas: "15:30", nazev: "Krájení dortu", ikona: "dort",
    popis: "První společný řez. Nůž držíme oba, vinu neseme napůl." },
  { cas: "16:30", nazev: "První tanec", ikona: "tanec",
    popis: "Jeden tanec a žádné záruky elegance." },
  { cas: "Odpoledne", nazev: "Svatební odpoledne", ikona: "odpoledne",
    popis: "Dobré jídlo, sklenka v ruce a čas užít si den naplno." },
  { cas: "Od 19:00", nazev: "Večerní párty", ikona: "party",
    popis: "Boty dolů, hudbu nahoru." },
];

// den ve dvou půlkách: obřad (do oběda) a oslava
export const PULKY = [
  { nazev: "Obřad", body: PROGRAM.slice(0, 3) },
  { nazev: "Oslava", body: PROGRAM.slice(3) },
];
