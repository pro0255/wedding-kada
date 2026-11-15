import type { Metadata } from "next";
import Link from "next/link";
import { odkazWhatsapp, seznamFotek } from "@/lib/fotky";
import { jeSpravce } from "@/lib/fotkyPristup";
import { HRY, prehledHer } from "@/lib/hra";
import { AdminDalSchema } from "@/lib/schemata";
import { BASE_ID as AIRTABLE_BASE, KAPACITA_CELKEM, stavKapacity } from "@/lib/ubytovani";
import { HRY_REGISTR } from "../hry/hry";
import s from "./admin.module.css";
import AdminVstup from "./AdminVstup";
import Odhlasit from "./Odhlasit";
import StahnoutFotky, { type Polozka } from "./StahnoutFotky";

export const metadata: Metadata = {
  title: "Správa · Kateřina & Jakub",
  robots: { index: false, follow: false },
};

/* Rozcestník pro snoubence, rozdělený podle témat: u každého živé číslo,
   co se dá udělat a kde se to spravuje. Bez správcovské cookie ukáže
   přihlášení (stejné heslo jako správa galerie, FOTKY_SPRAVCE).

   Stránky v tématu „Oznámení a návrhy“ hlídá proxy.ts — nová stránka jen
   pro správce patří i tam. Odkazy ven vedou do administrace služeb; bez
   přihlášení do nich nic neukážou, takže nevadí, že jsou ve veřejném
   repozitáři. */
type Odkaz = { href: string; nazev: string; popis: string };

const VERCEL = "https://vercel.com/pro0255s-projects/wedding-kada";
const GITHUB = "https://github.com/pro0255/wedding-kada";
const CLOUDINARY =
  "https://console.cloudinary.com/app/c-9f1e63fb26dfe57433b1890c1d5a5a/assets/media_library/folders/home?view_mode=mosaic";

const ODKAZY = {
  fotky: [
    {
      href: "/fotky",
      nazev: "Moderace galerie",
      popis:
        "Galerie, jak ji vidí hosté. Jako správce smažete i cizí fotku — zmizí z galerie i z Cloudinary naráz.",
    },
    {
      href: CLOUDINARY,
      nazev: "Cloudinary",
      popis:
        "Úložiště souborů (free: 25 kreditů za 30 dní, nejvíc je žere přehrávání videí). Spotřebu ukáže sekce Usage. Mazat raději v galerii — fotka smazaná jen tady v ní zůstane jako rozbitý obrázek.",
    },
  ],
  ubytovani: [
    {
      href: `https://airtable.com/${AIRTABLE_BASE}`,
      nazev: "Airtable",
      popis: `Rezervace z formuláře (tabulka Rezervace), kapacita ${KAPACITA_CELKEM} míst. Tady se opravují i mažou. Mail o nové rezervaci posílá automatizace v záložce Automations.`,
    },
  ],
  hry: [
    {
      href: "/hry",
      nazev: "Hry a žebříčky",
      popis: "Tři hry pro hosty a jejich žebříčky, jak je vidí hosté.",
    },
  ],
  tisk: [
    {
      href: "/oznameni",
      nazev: "Svatební oznámení",
      popis: "Tisková verze — líc i rub, k vyladění a exportu do PDF.",
    },
    {
      href: "/navrh",
      nazev: "Návrhy",
      popis: "Prototypy sekcí webu vedle sebe na desktopu i telefonu.",
    },
  ],
  web: [
    {
      href: "/?svatba=1",
      nazev: "Hlavní stránka",
      popis:
        "Svatební web pro hosty. Odkaz funguje i po svatbě, kdy hlavní stránka vede na poděkování.",
    },
    {
      href: "/podekovani",
      nazev: "Poděkování",
      popis:
        "Web po svatbě: poděkování, fotky a hry. Od rána po svatbě na něj vede hlavní stránka.",
    },
  ],
  technika: [
    {
      href: `${VERCEL}/settings/environment-variables`,
      nazev: "Hesla a klíče",
      popis:
        "Odpověď u vstupu do galerie (FOTKY_HESLO), správcovské heslo (FOTKY_SPRAVCE) a klíče ke službám. Platí až po novém nasazení; nové heslo odhlásí všechny přihlášené starým.",
    },
    {
      href: VERCEL,
      nazev: "Nasazení a logy",
      popis:
        "Vercel — kde web běží. Vrácení na starší verzi (Instant Rollback) a v záložce Logs chyby z nahrávání, rezervací a her.",
    },
    {
      href: `${VERCEL}/stores`,
      nazev: "Databáze",
      popis:
        "Upstash Redis (svatba-redis): záznamy fotek, lajky, skóre, jména hostů. Z detailu úložiště vede odkaz do konzole, kde jdou záznamy upravit.",
    },
    {
      href: `${GITHUB}/actions`,
      nazev: "Běhy nasazení",
      popis:
        "GitHub Actions — každý push na main tu spustí nasazení. Když web po změně nenaběhne, chyba je tady.",
    },
    {
      href: GITHUB,
      nazev: "Kód webu",
      popis:
        "Veřejný repozitář — hesla a jméno psa do něj nepatří, jsou jen ve Vercelu a v .env.local.",
    },
  ],
} satisfies Record<string, Odkaz[]>;

/* Odkaz na skupinu je jen v prostředí (veřejný repozitář), proto se karta skládá až tady. */
function whatsappKarta(): Odkaz[] {
  const odkaz = odkazWhatsapp();
  return odkaz
    ? [
        {
          href: odkaz,
          nazev: "WhatsApp skupina",
          popis:
            "Záloha, když nahrávání na webu nejde — hosté ji uvidí jen po neúspěšném nahrání. Fotky odtud do galerie ani do ZIPu nepřejdou, stáhněte je po svatbě zvlášť.",
        },
      ]
    : [];
}

const TEMATA = [
  { id: "fotky", nazev: "Fotky" },
  { id: "ubytovani", nazev: "Ubytování" },
  { id: "hry", nazev: "Hry" },
  { id: "tisk", nazev: "Oznámení" },
  { id: "web", nazev: "Web" },
  { id: "technika", nazev: "Technika" },
] as const;

const jeVen = (href: string) => href.startsWith("https://");

function Karty({ odkazy }: { odkazy: Odkaz[] }) {
  return (
    <div className={s.karty}>
      {odkazy.map((o) => {
        const ven = jeVen(o.href);
        const obsah = (
          <>
            <span className={s.kartaNazev}>
              {o.nazev}
              {ven && <span aria-label=" (otevře se v nové záložce)"> ↗</span>}
            </span>
            <span className={s.kartaPopis}>{o.popis}</span>
            <span className={s.kartaAdresa}>{ven ? new URL(o.href).host : o.href}</span>
          </>
        );
        return ven ? (
          <a
            key={o.href}
            href={o.href}
            className={s.karta}
            target="_blank"
            rel="noopener noreferrer"
          >
            {obsah}
          </a>
        ) : (
          <Link key={o.href} href={o.href} className={s.karta}>
            {obsah}
          </Link>
        );
      })}
    </div>
  );
}

function Tema({
  id,
  nazev,
  popis,
  cislo,
  children,
}: {
  id: string;
  nazev: string;
  popis: string;
  cislo?: { hodnota: string; poznamka: string };
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={s.tema} aria-labelledby={`${id}-nadpis`}>
      <div className={s.temaHlava}>
        <div>
          <h2 id={`${id}-nadpis`}>{nazev}</h2>
          <p>{popis}</p>
        </div>
        {cislo && (
          <p className={s.temaCislo}>
            <span className={s.cisloHodnota}>{cislo.hodnota}</span>
            <span className={s.cisloPoznamka}>{cislo.poznamka}</span>
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

/* Živá čísla. Každé se načítá zvlášť: když jedna služba nejede, ostatní
   čísla i zbytek rozcestníku se ukážou dál. */
const nebo = <T,>(slib: Promise<T>): Promise<T | null> =>
  slib.catch((error) => {
    console.error("[admin] přehled:", error);
    return null;
  });

const sklonuj = (n: number, jedna: string, dve: string, pet: string) =>
  `${n} ${n === 1 ? jedna : n >= 2 && n <= 4 ? dve : pet}`;

function Prihlaseni({ dal, zFiltru }: { dal: string; zFiltru: boolean }) {
  return (
    <main className={s.stranka}>
      <header className={s.hlava}>
        <p className={s.stitek}>Kateřina &amp; Jakub · správa</p>
        <h1 className={s.nadpis}>Jen pro nás</h1>
        <p className={s.uvod}>
          {zFiltru
            ? "Tahle stránka je jen pro snoubence. Zadejte správcovské heslo."
            : "Zadejte správcovské heslo."}
        </p>
      </header>
      <AdminVstup dal={dal} />
    </main>
  );
}

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ dal?: string | string[] }>;
}) {
  if (!(await jeSpravce())) {
    const dal = AdminDalSchema.safeParse((await searchParams).dal);
    return <Prihlaseni dal={dal.success ? dal.data : "/admin"} zFiltru={dal.success} />;
  }

  const [kapacita, galerie, hry] = await Promise.all([
    nebo(stavKapacity()),
    nebo(seznamFotek("")),
    nebo(prehledHer()),
  ]);
  const jeVideo = (url: string) => url.includes("/video/upload/");
  const polozka = ({ url, nahrano }: Polozka): Polozka => ({ url, nahrano });
  const fotky = (galerie ?? []).filter((f) => !jeVideo(f.url)).map(polozka);
  const videa = (galerie ?? []).filter((f) => jeVideo(f.url)).map(polozka);
  const srdicek = (galerie ?? []).reduce((n, f) => n + f.lajky, 0);

  return (
    <main className={s.stranka}>
      <header className={s.hlava}>
        <p className={s.stitek}>Kateřina &amp; Jakub · správa</p>
        <h1 className={s.nadpis}>Rozcestník</h1>
      </header>

      <nav className={s.lista} aria-label="Témata">
        {TEMATA.map((t) => (
          <a key={t.id} href={`#${t.id}`}>
            {t.nazev}
          </a>
        ))}
      </nav>

      <Tema
        id="fotky"
        nazev="Fotky od hostů"
        popis="Co hosté nahráli, mazání a stažení všeho najednou. Hned po svatbě stáhněte fotky i videa a uložte je jinam (Google Fotky, Disk) — free Cloudinary po vyčerpání kreditů může přestat soubory doručovat."
        cislo={
          galerie
            ? {
                hodnota: String(fotky.length),
                poznamka: `${sklonuj(fotky.length, "fotka", "fotky", "fotek")} · ${sklonuj(videa.length, "video", "videa", "videí")} · ${sklonuj(srdicek, "srdíčko", "srdíčka", "srdíček")}`,
              }
            : { hodnota: "—", poznamka: "galerie teď neodpovídá" }
        }
      >
        {galerie && <StahnoutFotky fotky={fotky} videa={videa} />}
        <Karty odkazy={[...ODKAZY.fotky, ...whatsappKarta()]} />
      </Tema>

      <Tema
        id="ubytovani"
        nazev="Ubytování"
        popis="Rezervace z formuláře na webu."
        cislo={
          kapacita
            ? {
                hodnota: `${kapacita.obsazeno} / ${kapacita.celkem}`,
                poznamka: `obsazeno · volno ${kapacita.volno}`,
              }
            : { hodnota: "—", poznamka: "Airtable teď neodpovídá" }
        }
      >
        <Karty odkazy={ODKAZY.ubytovani} />
      </Tema>

      <Tema
        id="hry"
        nazev="Hry"
        popis="Kolik hostů hrálo a v čem."
        cislo={
          hry
            ? {
                hodnota: String(hry.celkem),
                poznamka: `${sklonuj(hry.celkem, "hráč", "hráči", "hráčů")} · ${hry.jmen} se jménem`,
              }
            : { hodnota: "—", poznamka: "žebříčky teď neodpovídají" }
        }
      >
        {hry && (
          <ul className={s.seznam}>
            {HRY.map((h) => (
              <li key={h}>
                <span>{HRY_REGISTR[h].nazev}</span>
                <span className={s.seznamCislo}>
                  {sklonuj(hry.hraci[h], "hráč", "hráči", "hráčů")}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Karty odkazy={ODKAZY.hry} />
      </Tema>

      <Tema
        id="tisk"
        nazev="Oznámení a návrhy"
        popis="Jen pro vás — bez správcovského hesla se sem nikdo nedostane."
      >
        <Karty odkazy={ODKAZY.tisk} />
      </Tema>

      <Tema id="web" nazev="Web pro hosty" popis="Veřejné stránky, jak je vidí hosté.">
        <Karty odkazy={ODKAZY.web} />
      </Tema>

      <Tema
        id="technika"
        nazev="Technika"
        popis="Hesla, nasazení a data. Sem jen když je potřeba — odkazy chtějí přihlášení do dané služby."
      >
        <Karty odkazy={ODKAZY.technika} />
      </Tema>

      <Odhlasit />
    </main>
  );
}
