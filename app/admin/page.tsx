import type { Metadata } from "next";
import Link from "next/link";
import { jeSpravce } from "@/lib/fotkyPristup";
import { AdminDalSchema } from "@/lib/schemata";
import { BASE_ID as AIRTABLE_BASE, KAPACITA_CELKEM } from "@/lib/ubytovani";
import AdminVstup from "./AdminVstup";
import Odhlasit from "./Odhlasit";
import s from "./admin.module.css";

export const metadata: Metadata = {
  title: "Správa · Kateřina & Jakub",
  robots: { index: false, follow: false },
};

/* Rozcestník pro snoubence. Bez správcovské cookie ukáže přihlášení
   (stejné heslo jako správa galerie, FOTKY_SPRAVCE). Stránky ze skupiny
   „Jen pro vás“ hlídá proxy.ts — nová stránka jen pro správce patří i tam.

   Odkazy ven vedou do administrace služeb; bez přihlášení do nich nic
   neukážou, takže nevadí, že jsou ve veřejném repozitáři. */
type Odkaz = { href: string; nazev: string; popis: string };

const VERCEL = "https://vercel.com/pro0255s-projects/wedding-kada";
const GITHUB = "https://github.com/pro0255/wedding-kada";

const JEN_PRO_VAS: Odkaz[] = [
  {
    href: "/oznameni",
    nazev: "Svatební oznámení",
    popis: "Tisková verze oznámení — líc i rub, k vyladění a exportu do PDF.",
  },
  {
    href: "/navrh",
    nazev: "Návrhy",
    popis: "Prototypy sekcí webu vedle sebe na desktopu i telefonu, s měřičem plynulosti.",
  },
];

const SPRAVA: Odkaz[] = [
  {
    href: `https://airtable.com/${AIRTABLE_BASE}`,
    nazev: "Ubytování — Airtable",
    popis:
      `Rezervace z formuláře na webu (tabulka Rezervace), kapacita ${KAPACITA_CELKEM} míst. Tady se rezervace opravují i mažou. Mail o nové rezervaci posílá automatizace v záložce Automations.`,
  },
  {
    href: "/fotky",
    nazev: "Fotky od hostů — moderace",
    popis:
      "Galerie, jak ji vidí hosté. Jako správce tu smažete i cizí fotku — zmizí z galerie i z Cloudinary naráz. Mazat fotky jde nejlíp tady.",
  },
  {
    href: "https://console.cloudinary.com/",
    nazev: "Soubory fotek — Cloudinary",
    popis:
      "Úložiště fotek a videí, které hosté nahrávají z mobilu. Media Library = všechny soubory (stažení všeho najednou), Settings → Upload = upload preset. Fotka smazaná jen tady zůstane v galerii jako rozbitý obrázek.",
  },
  {
    href: `${VERCEL}/stores`,
    nazev: "Databáze — Upstash Redis",
    popis:
      "Živá data ze svatebního dne (úložiště svatba-redis): seznam fotek a lajky, skóre ve hrách, jména hostů a počítadla špatných pokusů u vstupu. Z detailu úložiště vede odkaz do konzole Upstash, kde jdou záznamy prohlížet i upravit.",
  },
  {
    href: `${VERCEL}/settings/environment-variables`,
    nazev: "Hesla a klíče — Vercel",
    popis:
      "Odpověď na otázku u vstupu do galerie (FOTKY_HESLO), správcovské heslo (FOTKY_SPRAVCE) a klíče ke službám. Změna se projeví až po novém nasazení; nové heslo odhlásí všechny, kdo se přihlásili tím starým.",
  },
  {
    href: VERCEL,
    nazev: "Nasazení a logy — Vercel",
    popis:
      "Kde web běží. Přehled nasazení (vrácení na starší verzi přes Instant Rollback) a v záložce Logs chyby z nahrávání fotek, rezervací a her.",
  },
  {
    href: `${GITHUB}/actions`,
    nazev: "Běhy nasazení — GitHub Actions",
    popis: "Každý push na main tu spustí nasazení na Vercel. Když web po změně nenaběhne, chyba je tady.",
  },
  {
    href: GITHUB,
    nazev: "Kód webu — GitHub",
    popis: "Zdrojový kód. Repozitář je veřejný — hesla a jméno psa do něj nepatří, jsou jen ve Vercelu a v .env.local.",
  },
];

const WEB_PRO_HOSTY: Odkaz[] = [
  {
    href: "/?svatba=1",
    nazev: "Hlavní stránka",
    popis: "Svatební web, jak ho vidí hosté. Odkaz funguje i po svatbě, kdy hlavní stránka vede na poděkování.",
  },
  {
    href: "/podekovani",
    nazev: "Poděkování",
    popis: "Web po svatbě: poděkování, fotky od hostů a hry. Od rána po svatbě na něj vede hlavní stránka.",
  },
  {
    href: "/hry",
    nazev: "Hry a žebříčky",
    popis: "Tři hry pro hosty a jejich žebříčky.",
  },
];

const jeVen = (href: string) => href.startsWith("https://");

function Karty({ odkazy }: { odkazy: Odkaz[] }) {
  return (
    <div className={s.karty}>
      {odkazy.map((o) => {
        const obsah = (
          <>
            <span className={s.kartaNazev}>
              {o.nazev}
              {jeVen(o.href) && <span aria-label=" (otevře se v nové záložce)"> ↗</span>}
            </span>
            <span className={s.kartaPopis}>{o.popis}</span>
            <span className={s.kartaAdresa}>
              {jeVen(o.href) ? new URL(o.href).host : o.href}
            </span>
          </>
        );
        return jeVen(o.href) ? (
          <a key={o.href} href={o.href} className={s.karta} target="_blank" rel="noopener noreferrer">
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

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ dal?: string | string[] }>;
}) {
  if (!(await jeSpravce())) {
    const dal = AdminDalSchema.safeParse((await searchParams).dal);
    return (
      <main className={s.stranka}>
        <header className={s.hlava}>
          <p className={s.stitek}>Kateřina &amp; Jakub · správa</p>
          <h1 className={s.nadpis}>Jen pro nás</h1>
          <p className={s.uvod}>
            {dal.success
              ? "Tahle stránka je jen pro snoubence. Zadejte správcovské heslo."
              : "Zadejte správcovské heslo."}
          </p>
        </header>
        <AdminVstup dal={dal.success ? dal.data : "/admin"} />
      </main>
    );
  }

  return (
    <main className={s.stranka}>
      <header className={s.hlava}>
        <p className={s.stitek}>Kateřina &amp; Jakub · správa</p>
        <h1 className={s.nadpis}>Rozcestník</h1>
      </header>

      <section className={s.skupina}>
        <div className={s.skupinaHlava}>
          <h2>Jen pro vás</h2>
          <p>Bez správcovského hesla se sem nikdo nedostane.</p>
        </div>
        <Karty odkazy={JEN_PRO_VAS} />
      </section>

      <section className={s.skupina}>
        <div className={s.skupinaHlava}>
          <h2>Správa</h2>
          <p>Kde se co spravuje. Odkazy ven se otevřou v nové záložce a chtějí přihlášení do dané služby.</p>
        </div>
        <Karty odkazy={SPRAVA} />
      </section>

      <section className={s.skupina}>
        <div className={s.skupinaHlava}>
          <h2>Web pro hosty</h2>
          <p>Veřejné stránky, jak je vidí hosté.</p>
        </div>
        <Karty odkazy={WEB_PRO_HOSTY} />
      </section>

      <Odhlasit />
    </main>
  );
}
