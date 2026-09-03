/* Motýli poletující nad bočními květinovými pruhy.

   V podkladu pruhu byli původně natištění, takže stáli. Skript
   scripts/pruh-kvetin.mjs je z něj vyřízne do vlastních PNG s průhledností
   a z pruhu je vymaže — tady se pak vykreslí jako samostatné obrázky, které
   se dají rozpohybovat.

   Poloha se váže na --kv-sirka, tedy na skutečnou šířku pruhu, ne na vw.
   Pruh se totiž nad 1600px zastaví na 400px a při pevných vw by motýli
   odletěli doprostřed stránky. Takhle zůstanou nad květinami v každé šířce.

   Vodorovné odsazení je násobek šířky pruhu a měří se od jeho vnějšího
   okraje; u pravé strany se počítá od pravého okraje, takže obě strany
   používají kladné hodnoty. */

/* Kolik jich má poletovat. Jediné číslo, kterým se to ladí. */
const POCET = 18;

/* Kde končí obsah stránky. Dekorační vrstva .kvetiny je vysoká 15000px, ale
   začíná až pod hero sekcí, takže užitečný pás je zhruba o 800px kratší než
   celá stránka. Motýli se rozsadí sem, aby žádný nezůstal pod patičkou. */
const OD = 700, DO = 7300;

/* Tři tvary ve čtyřech barvách palety. Tvary jsou všechny z modrých předloh,
   barvy dodělal scripts/pruh-kvetin.mjs přebarvením — růžové předlohy byly
   natočené jinak a mávání jim sedělo hůř. */
const TVARY = ["1", "2", "3"];
const BARVY = ["modry", "ruzovy", "broskvovy", "zluty"];
const SOUBORY = TVARY.flatMap((t) => BARVY.map((b) => `${b}-${t}`));

/* Deterministický šum: stejné pořadí i po přegenerování, takže se motýli
   nepřeskládají při každém načtení stránky a nedělají neklid. Kdyby to bylo
   opravdu náhodné, každý build by vypadal jinak a nešlo by to doladit. */
function sum(i: number, posun: number) {
  const x = Math.sin((i + 1) * 12.9898 + posun * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const MOTYLI = Array.from({ length: POCET }, (_, i) => {
  const krok = (DO - OD) / (POCET - 1);
  /* rozestup s rozházením, ať nejsou jako korálky na niti */
  const vyska = Math.round(OD + i * krok + (sum(i, 1) - 0.5) * krok * 0.7);
  /* strany se střídají, ale ne pravidelně — jednou za čas přijdou dva po sobě */
  const strana: "l" | "r" = sum(i, 2) > 0.45 ? (i % 2 ? "r" : "l") : (i % 2 ? "l" : "r");
  return {
    klic: `m${i}`,
    /* krok 5 přes dvanáct souborů = barva i tvar se střídají jinak než
       obden, takže se dvojice barva+tvar nezopakuje dřív než po dvanácti */
    soubor: SOUBORY[(i * 5) % SOUBORY.length],
    strana,
    odsazeni: 0.46 + sum(i, 3) * 0.46,
    vyska,
    /* Větší než dřív (21-36 px). Mávnutí je otočení kolem osy těla a to se
       na drobné skvrnce nemá kde projevit — změřeno, že při 33 px se silueta
       měnila jen o 5,6 px a oko to nezachytilo. */
    sirka: Math.round(32 + sum(i, 4) * 22),
    /* okruh letu: kratší než původních 15-27 s, aby to bylo poletování
       a ne plachtění — ale ne tak krátký, aby osmnáct motýlů dělalo neklid */
    doba: Math.round(10 + sum(i, 5) * 8),
    zpozdeni: +(sum(i, 6) * 9).toFixed(1),
    /* Vlastní tempo mávnutí. Kdyby měli všichni stejné, drželi by si pevný
       rozestup a mávali by pořád jako sbor — i s rozházenou fází. Různá doba
       je od sebe rozvádí donekonečna. */
    tempo: +(0.25 + sum(i, 16) * 0.2).toFixed(3),
    zrcadlo: sum(i, 7) > 0.5 ? -1 : 1,
    /* Natočení, aby dvanáct obrázků nepůsobilo jako dvanáct razítek. Rozsah
       je jen ±15°, ne ±38° jako dřív: tělo předlohy už samo leží asi 30° od
       svislice, takže větší naklonění motýla položilo na bok. */
    uhel: Math.round((sum(i, 15) - 0.5) * 30),
    /* Fáze je ZÁPORNÁ — animace tím startuje rozjetá uprostřed cyklu místo
       aby čekala. Kladné zpoždění by motýla nechalo pár vteřin viset nehybně. */
    faze: +(sum(i, 14) * 0.9).toFixed(2),
    drah: [
      [Math.round((sum(i, 8) - 0.35) * 70), Math.round((sum(i, 9) - 0.5) * 54)],
      [Math.round((sum(i, 10) - 0.35) * 70), Math.round((sum(i, 11) - 0.5) * 54)],
      [Math.round((sum(i, 12) - 0.35) * 70), Math.round((sum(i, 13) - 0.5) * 54)],
    ] as [number, number][],
  };
});

export default function Motyli() {
  return (
    <>
      {MOTYLI.map((m) => {
        /* u pravé strany letí dráha zrcadlově, jinak by všichni mířili doprava */
        const smer = m.strana === "r" ? -1 : 1;
        const [[x1, y1], [x2, y2], [x3, y3]] = m.drah;
        return (
          <span
            key={m.klic}
            className={`motyl motyl-${m.strana}`}
            style={{
              "--motyl-odsazeni": m.odsazeni.toFixed(2),
              "--motyl-vyska": `${m.vyska}px`,
              "--motyl-sirka": `${m.sirka}px`,
              "--motyl-doba": `${m.doba}s`,
              "--motyl-zpozdeni": `${m.zpozdeni}s`,
              "--motyl-faze": `-${m.faze}s`,
              "--motyl-tempo": `${m.tempo}s`,
              "--motyl-zrcadlo": m.zrcadlo,
              "--motyl-uhel": `${m.uhel}deg`,
              "--x1": `${x1 * smer}px`, "--y1": `${y1}px`,
              "--x2": `${x2 * smer}px`, "--y2": `${y2}px`,
              "--x3": `${x3 * smer}px`, "--y3": `${y3}px`,
            } as React.CSSProperties}
          >
            <img className="motyl-kridlo" src={`/fotky/motyl-${m.soubor}.png`} alt="" aria-hidden="true" />
          </span>
        );
      })}
    </>
  );
}
