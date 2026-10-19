import type { Metadata } from "next";
import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import Nahled from "./Nahled";
import s from "./navrh.module.css";

export const metadata: Metadata = {
  title: "Návrhy — výběr",
  robots: { index: false, follow: false },
};

/* Rozcestník prototypů: každá verze živě na desktopu i na telefonu vedle sebe.
   Seznam drží ruka; verze, jejíž stránka ještě neexistuje, se vynechá — agenti
   je dodělávají postupně. Kód (O1, M4…) je to, co host napíše při výběru. */
/* `mereni`: nejdelší snímek při 1. otevření / zavření / 2. otevření na telefonu
   (390 px, procesor 4× zpomalený, produkční build). Plynulé je pod 25 ms. */
type Verze = { kod: string; href: string; nazev: string; popis: string; mereni?: string };
type Skupina = { id: string; nazev: string; popis: string; verze: Verze[] };

const SKUPINY: Skupina[] = [
  {
    id: "brana",
    nazev: "Vstup k fotkám",
    popis: "Galerii otevře jen ten, kdo ví, jak se jmenuje váš pes. Naostro odpověď ověří server a host ji zadá jen jednou — zařízení si vstup pamatuje. Prototypy jsou jen lokálně (app/navrh/fotky je v .gitignore), aby jméno psa nebylo ve veřejném repozitáři.",
    verze: [
      { kod: "B1", href: "/navrh/fotky/brana/v1", nazev: "Pes hlídá dveře", popis: "Akvarelový pes s kyticí sedí u dveří a ptá se. Na špatné jméno nakloní hlavu, na správné zavrtí ocasem a pustí vás dál." },
      { kod: "B2", href: "/navrh/fotky/brana/v2", nazev: "Psí známka", popis: "Zlatá známka z obojku, do které se jméno vyryje. Správné jméno známka cinkne a otočí se." },
      { kod: "B3", href: "/navrh/fotky/brana/v3", nazev: "Zavolejte ho", popis: "Zavolejte psa jménem. Na správné jméno přiběhne a přinese galerii." },
      { kod: "B4", href: "/navrh/fotky/brana/v4", nazev: "Kdo je na fotce?", popis: "Rozmazaná fotka psa. Špatné pokusy přidávají nápovědy, správné jméno fotku zaostří a otevře galerii." },
    ],
  },
  {
    id: "galerie",
    nazev: "Fotky po svatbě",
    popis: "Jak bude vypadat galerie, až bude po svatbě. Zástupné fotky jsou z příběhu.",
    verze: [
      { kod: "G1", href: "/navrh/fotky/galerie/v1", nazev: "Album dne", popis: "Fotky seřazené podle programu: snídaně, obřad, oběd, dort, tanec, párty." },
      { kod: "G2", href: "/navrh/fotky/galerie/v2", nazev: "Mozaika s oblíbenými", popis: "Nahoře nejvíc lajkované fotky, pod nimi mozaika všech." },
      { kod: "G3", href: "/navrh/fotky/galerie/v3", nazev: "Promítání", popis: "Fotky se pouští jako promítání přes celou obrazovku, s přehledem pod ním." },
    ],
  },
  {
    id: "pribeh",
    nazev: "Náš příběh",
    popis: "Šest úplně odlišných podob sekce s fotkami a dopisem. Popisky fotek jsou ve všech text, ne obrázek, a každá varianta zkouší jiné písmo.",
    verze: [
      { kod: "S1", href: "/navrh/pribeh/v1", nazev: "Fotky na šňůře", popis: "Polaroidy zavěšené na provázku dřevěnými kolíčky, šňůra se táhne prstem nebo myší." },
      { kod: "S2", href: "/navrh/pribeh/v2", nazev: "Fotoalbum", popis: "Rozevřené album s rožky na fotkách, dopis na první straně, listuje se jako v knize." },
      { kod: "S3", href: "/navrh/pribeh/v3", nazev: "Obálka plná fotek", popis: "Jedna obálka uprostřed. Po rozlomení pečeti z ní vyjedou fotky do vějíře a dopis." },
      { kod: "S4", href: "/navrh/pribeh/v4", nazev: "Kapitoly", popis: "Časopisecká dvoustrana: dopis rozdělený do kapitol, ke každé velká fotka." },
      { kod: "S5", href: "/navrh/pribeh/v5", nazev: "Příběh při scrollu", popis: "Věty dopisu se odvíjí při posouvání stránky a fotky se k nim skládají na hromádku." },
      { kod: "S6", href: "/navrh/pribeh/v6", nazev: "Kontaktní arch", popis: "Fotky jako filmový pás / kontaktní arch z fotokomory, psacím strojem popsané." },
    ],
  },
  {
    id: "program",
    nazev: "Program dne",
    popis: "Teď je program jediná sekce, která není „papírový předmět“ — sedm úzkých sloupců s pilulkami, které nikde jinde na webu nejsou. Kresby zůstávají ve všech verzích.",
    verze: [
      { kod: "H1", href: "/navrh/program/v1", nazev: "Tištěná karta", popis: "Program na kartě ze stejného papíru a se stejným zlatým rámečkem jako menu. Body pod sebou: čas, kresba, název, popis." },
      { kod: "H2", href: "/navrh/program/v2", nazev: "Svislá osa", popis: "Tenká linka středem, velký čas na jedné straně, kresba s textem na druhé, strany se střídají." },
      { kod: "H3", href: "/navrh/program/v3", nazev: "Dvě půlky dne", popis: "Dvě lehce natočené karty vedle sebe: Obřad a Oslava." },
      { kod: "H4", href: "/navrh/program/v4", nazev: "Řada jako odpočet", popis: "Nejmenší změna: vodorovná řada, ale čas velkými číslicemi a svislé vlásečnice jako v odpočtu, bez pilulek a čáry." },
    ],
  },
  {
    id: "obalka",
    nazev: "Obálka v příběhu",
    popis: "Fotky vlevo, obálka přes jejich roh, kolem svatební květiny. Klepnutím na obálku se otevře dopis s příběhem.",
    verze: [
      {
        kod: "O1",
        href: "/navrh/obalka/v1",
        nazev: "Skutečný 3D model (three.js)",
        popis: "CC0 model obálky s chlopní na pantu, měkké stíny, zrno papíru. Pečeť se rozlomí, dopis vyjede a rozloží se, snítka v rohu vrhá stín. Myš obálku naklání. three.js web už používá pro prsten v úvodu.",
        mereni: "18 / 17 / 9 ms",
      },
      {
        kod: "O2",
        href: "/navrh/obalka/v2",
        nazev: "Čisté CSS 3D",
        popis: "Chlopeň na skutečném pantu, podšívka na rubu, pečeť se rozlomí, dopis vyjede a rozloží se. Text dopisu je nejostřejší. Bez knihovny, nejlehčí.",
        mereni: "13 / 17 / 9 ms",
      },
      {
        kod: "O3",
        href: "/navrh/obalka/v3",
        nazev: "Dopis poštou (GSAP)",
        popis: "Obálka leží adresou nahoru se známkou s vaší fotkou a razítkem Rekovic. Po klepnutí se otočí na rub, pečeť praskne se zlatými jiskrami a dopis vyjede.",
        mereni: "16 / 9 / 10 ms",
      },
      {
        kod: "O4",
        href: "/navrh/obalka/v4",
        nazev: "Další verze",
        popis: "Zobrazí se, až ji agent dodělá.",
      },
    ],
  },
  {
    id: "menu",
    nazev: "Svatební menu",
    popis: "Plochý papír se zlatým rámečkem. Liší se tím, jak se menu otevře.",
    verze: [
      {
        kod: "M1",
        href: "/navrh/menu/v1",
        nazev: "Kniha s tloušťkou (CSS 3D)",
        popis: "Deska s hranami a blokem listů se nadzvedne, přetočí přes hřbet s odleskem a dosedne s překmitem. Na telefonu se listuje prstem.",
        mereni: "9 / 18 / 9 ms",
      },
      {
        kod: "M2",
        href: "/navrh/menu/v2",
        nazev: "Trojdílná skládačka",
        popis: "Menu uprostřed, obálka se odklopí doprava, úvodní křídlo doleva. Na telefonu svisle.",
        mereni: "9 / 9 / 18 ms",
      },
      {
        kod: "M3",
        href: "/navrh/menu/v3",
        nazev: "Karty v kapse",
        popis: "Karty se vytáhnou z papírové kapsy a rozloží vedle sebe. Na telefonu se míchají.",
        mereni: "16 / 17 / 9 ms",
      },
      {
        kod: "M4",
        href: "/navrh/menu/v4",
        nazev: "Kniha ve 3D (WebGL)",
        popis: "Kniha z M1 jako skutečný 3D objekt: zaoblené desky, hřbet, blok listů a zlatá ražba, po které při otáčení přejede odlesk. Deska se přetočí přes hřbet a dopadne. Kolem leží svatební květiny v pravých barvách. Na telefonu jedna strana naráz.",
        mereni: "10 / 11 / 9 ms",
      },
      {
        kod: "M5",
        href: "/navrh/menu/v5",
        nazev: "Kniha + 3D prvek",
        popis: "Kniha z M1 beze změny a vedle ní dva zlaté 3D prstýnky — stejné zlato jako prsten v úvodu webu. Při otevření po nich přejede odlesk. Kolem svatební květiny.",
        mereni: "9 / 9 / 18 ms",
      },
    ],
  },
];

const existuje = (href: string) =>
  existsSync(path.join(process.cwd(), "app", ...href.split("/").filter(Boolean), "page.tsx"));

export default function Navrhy() {
  const skupiny = SKUPINY.map((g) => ({ ...g, verze: g.verze.filter((v) => existuje(v.href)) }));
  return (
    <main className={s.stranka}>
      <header className={s.hlava}>
        <p className={s.stitek}>Kateřina &amp; Jakub · návrhy</p>
        <h1 className={s.nadpis}>Vyberte verzi</h1>
        <p className={s.uvod}>
          Každá verze je živá — dá se na ni klepnout jako na webu. Vlevo desktop, vpravo telefon.
          Napište kód té, která se vám líbí nejvíc, třeba <b>O2 + M4</b>.
        </p>
        <p className={s.uvod}>
          Všech osm verzí je změřených na telefonu se 4× zpomaleným procesorem: žádná nemá
          snímek delší než 25 ms, takže se nic neseká. Na každé stránce verze je vpravo dole
          měřič, který to po klepnutí ověří i na vašem telefonu.
        </p>
        <nav className={s.kotvy} aria-label="Skupiny návrhů">
          {skupiny.map((g) => (
            <a key={g.id} href={`#${g.id}`}>
              {g.nazev}
            </a>
          ))}
          <Link href="/?svatba=1#story">Současný web</Link>
        </nav>
      </header>

      {skupiny.map((g) => (
        <section key={g.id} id={g.id} className={s.skupina}>
          <div className={s.skupinaHlava}>
            <h2>{g.nazev}</h2>
            <p>{g.popis}</p>
          </div>
          {g.verze.map((v) => (
            <article key={v.kod} className={s.verze}>
              <div className={s.verzeHlava}>
                <span className={s.kod}>{v.kod}</span>
                <div>
                  <h3>{v.nazev}</h3>
                  <p>{v.popis}</p>
                  {v.mereni && (
                    <p className={s.mereni}>
                      Plynulost na telefonu: nejdelší snímek {v.mereni} (otevření / zavření / znovu) · 0 cuknutí
                    </p>
                  )}
                </div>
                <a className={s.otevrit} href={v.href} target="_blank" rel="noopener">
                  Otevřít celou ↗
                </a>
              </div>
              <div className={s.nahledy}>
                <Nahled href={v.href} sirka={1280} vyska={1040} meritko={0.5} popisek="Desktop 1280 px" />
                <Nahled href={v.href} sirka={390} vyska={844} meritko={0.5} popisek="Telefon 390 px" />
              </div>
            </article>
          ))}
        </section>
      ))}
    </main>
  );
}
