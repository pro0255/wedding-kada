import type { Metadata } from "next";
import Link from "next/link";
import { jeSpravce } from "@/lib/fotkyPristup";
import { AdminDalSchema } from "@/lib/schemata";
import AdminVstup from "./AdminVstup";
import Odhlasit from "./Odhlasit";
import s from "./admin.module.css";

export const metadata: Metadata = {
  title: "Správa · Kateřina & Jakub",
  robots: { index: false, follow: false },
};

/* Rozcestník pro snoubence. Bez správcovské cookie ukáže přihlášení
   (stejné heslo jako správa galerie, FOTKY_SPRAVCE). Stránky z první
   skupiny hlídá proxy.ts — nová stránka jen pro správce patří i tam. */
type Odkaz = { href: string; nazev: string; popis: string };

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
    href: "/fotky",
    nazev: "Fotky od hostů",
    popis: "Galerie za otázkou na psa. Jako správce tu smažete i cizí fotku.",
  },
  {
    href: "/hry",
    nazev: "Hry a žebříčky",
    popis: "Tři hry pro hosty a jejich žebříčky.",
  },
];

function Karty({ odkazy }: { odkazy: Odkaz[] }) {
  return (
    <div className={s.karty}>
      {odkazy.map((o) => (
        <Link key={o.href} href={o.href} className={s.karta}>
          <span className={s.kartaNazev}>{o.nazev}</span>
          <span className={s.kartaPopis}>{o.popis}</span>
          <span className={s.kartaAdresa}>{o.href}</span>
        </Link>
      ))}
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
          <h2>Web pro hosty</h2>
          <p>Veřejné stránky, jak je vidí hosté.</p>
        </div>
        <Karty odkazy={WEB_PRO_HOSTY} />
      </section>

      <Odhlasit />
    </main>
  );
}
