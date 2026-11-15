import * as z from "zod/mini";

/**
 * Jeden katalog chyb pro server i prohlížeč.
 *
 * Každé místo, kde se něco nemusí povést, má svůj kód. Ke kódu patří
 * stavový kód HTTP, hláška pro hosta a dvě rady, co s tím: jestli má smysl
 * zkusit to znovu a jestli nabídnout kontakt na svědky. Route handlery
 * odpovídají přes `chybaOdpoved(kod)`, prohlížeč si odpověď přečte přes
 * `chybaZOdpovedi()` — obě strany tak mluví stejnými kódy a hláška se píše
 * jen tady.
 *
 * Modul je na `zod/mini` a bez dalších závislostí, takže ho smí importovat
 * i klientské komponenty (na rozdíl od schemata.ts).
 */

export const KODY_CHYB = [
  // vzniká jen v prohlížeči — požadavek vůbec neodešel nebo nepřišla odpověď
  "sit",
  // server odpověděl něčím, co neznáme (pád funkce, timeout, stará verze)
  "server",
  "neznama",

  // obecné
  "neplatny-pozadavek",

  // vstup do galerie / admin
  "bez-pristupu",
  "spatna-odpoved",
  "moc-pokusu",

  // ubytování
  "kapacita-nenactena",
  "rezervace-neplatna",
  "rezervace-duplicita",
  "rezervace-plno",
  "rezervace-malo-mist",
  "rezervace-neulozena",

  // galerie
  "galerie-nenactena",
  "fotka-neulozena",
  "fotka-nesmazana",
  "fotka-cizi",
  "fotka-neexistuje",
  "lajk-neulozen",

  // hry
  "neznama-hra",
  "jmeno-neplatne",
  "jmeno-nenacteno",
  "jmeno-neulozeno",
  "skore-neulozeno",
  "zebricek-nenacten",
  "lidri-nenacteni",
] as const;

export const KodChybySchema = z.enum(KODY_CHYB);
export type KodChyby = z.infer<typeof KodChybySchema>;

type Popis = {
  /** Stavový kód odpovědi; 0 = chyba vzniká jen v prohlížeči. */
  status: number;
  /** Text pro hosta. Bez oslovení, ať sedí na stránky s vykáním i do her. */
  hlaska: string;
  /** Má smysl zkusit totéž znovu? (tlačítko „Zkusit znovu“) */
  znovu: boolean;
  /** Nabídnout kontakt na svědky — host by jinak zůstal bez pomoci. */
  kontakt: boolean;
};

export const CHYBY = {
  sit: {
    status: 0,
    hlaska: "Nepodařilo se spojit se serverem — nejspíš slabý signál.",
    znovu: true,
    kontakt: false,
  },
  server: {
    status: 500,
    hlaska: "Na naší straně se něco pokazilo. Za chvilku by to mělo jít.",
    znovu: true,
    kontakt: true,
  },
  neznama: {
    status: 500,
    hlaska: "Něco se pokazilo.",
    znovu: true,
    kontakt: true,
  },

  "neplatny-pozadavek": {
    status: 400,
    hlaska: "Tohle se nepodařilo odeslat. Pomůže obnovit stránku.",
    znovu: false,
    kontakt: true,
  },

  "bez-pristupu": {
    status: 401,
    // bez jména psa — tuhle odpověď vidí i cizí
    hlaska: "Nejdřív odpovězte na otázku u vstupu.",
    znovu: false,
    kontakt: false,
  },
  "spatna-odpoved": {
    status: 401,
    hlaska: "Tak to není ono.",
    znovu: true,
    kontakt: false,
  },
  "moc-pokusu": {
    status: 429,
    hlaska: "Uf, to bylo hodně pokusů. Chvilku si odpočinu, zkuste to za minutu.",
    znovu: false,
    kontakt: true,
  },

  "kapacita-nenactena": {
    status: 502,
    hlaska: "Počet volných míst se nepodařilo načíst. Rezervovat jde i tak.",
    znovu: false,
    kontakt: false,
  },
  "rezervace-neplatna": {
    status: 400,
    hlaska: "Zkontrolujte prosím jméno a počet osob.",
    znovu: false,
    kontakt: false,
  },
  "rezervace-duplicita": {
    status: 409,
    hlaska:
      "Vypadá to, že rezervaci na toto jméno už máme. Změnu nebo doplnění s vámi vyřídí svědci.",
    znovu: false,
    kontakt: true,
  },
  "rezervace-plno": {
    status: 409,
    hlaska: "Kapacita ubytování je bohužel už plná.",
    znovu: false,
    kontakt: true,
  },
  "rezervace-malo-mist": {
    status: 409,
    hlaska: "Tolik volných míst už nezbývá.",
    znovu: false,
    kontakt: true,
  },
  "rezervace-neulozena": {
    status: 502,
    hlaska: "Rezervaci se nepodařilo uložit. Zkuste to prosím za chvíli.",
    znovu: true,
    kontakt: true,
  },

  "galerie-nenactena": {
    status: 502,
    hlaska: "Galerie se teď nenačetla — nejspíš slabý signál.",
    znovu: true,
    kontakt: false,
  },
  "fotka-neulozena": {
    status: 502,
    hlaska: "Fotku se nepodařilo uložit.",
    znovu: true,
    kontakt: false,
  },
  "fotka-nesmazana": {
    status: 502,
    hlaska: "Fotku se nepodařilo smazat, zůstává v galerii.",
    znovu: true,
    kontakt: true,
  },
  "fotka-cizi": {
    status: 403,
    hlaska: "Tuhle fotku nahrál někdo jiný (nebo jiný telefon), odsud smazat nejde.",
    znovu: false,
    kontakt: true,
  },
  "fotka-neexistuje": {
    status: 404,
    hlaska: "Tahle fotka už v galerii není.",
    znovu: false,
    kontakt: false,
  },
  "lajk-neulozen": {
    status: 502,
    hlaska: "Srdíčko se nepodařilo uložit.",
    znovu: true,
    kontakt: false,
  },

  "neznama-hra": {
    status: 400,
    hlaska: "Takovou hru tu nemáme.",
    znovu: false,
    kontakt: false,
  },
  "jmeno-neplatne": {
    status: 400,
    hlaska: "Jméno musí mít 1–30 znaků.",
    znovu: false,
    kontakt: false,
  },
  "jmeno-nenacteno": {
    status: 502,
    hlaska: "Jméno se nepodařilo načíst.",
    znovu: true,
    kontakt: false,
  },
  "jmeno-neulozeno": {
    status: 502,
    hlaska: "Jméno se nepodařilo uložit.",
    znovu: true,
    kontakt: false,
  },
  "skore-neulozeno": {
    status: 502,
    hlaska: "Skóre se nepodařilo zapsat do žebříčku.",
    znovu: true,
    kontakt: false,
  },
  "zebricek-nenacten": {
    status: 502,
    hlaska: "Žebříček se teď nenačetl.",
    znovu: true,
    kontakt: false,
  },
  "lidri-nenacteni": {
    status: 502,
    hlaska: "Lídry se nepodařilo načíst.",
    znovu: true,
    kontakt: false,
  },
} as const satisfies Record<KodChyby, Popis>;

/** Tělo chybové odpovědi API. `chyba` je hláška pro hosta, `kod` pro kód. */
export const ChybaOdpovedSchema = z.object({ kod: KodChybySchema, chyba: z.string() });
export type ChybaOdpoved = z.infer<typeof ChybaOdpovedSchema>;

/** Chyba, jak s ní pracuje rozhraní. */
export type Chyba = { kod: KodChyby; hlaska: string; znovu: boolean; kontakt: boolean };

/** Chyba z katalogu; `hlaska` přepíše výchozí text (např. „Zbývají 2 místa“). */
export function chyba(kod: KodChyby, hlaska?: string): Chyba {
  const { znovu, kontakt } = CHYBY[kod];
  return { kod, hlaska: hlaska || CHYBY[kod].hlaska, znovu, kontakt };
}

/**
 * Chybová odpověď route handleru. Stavový kód i hláška jdou z katalogu;
 * `navic` přibalí další data (stav kapacity) nebo přepíše hlášku.
 */
export function chybaOdpoved(
  kod: KodChyby,
  navic: { hlaska?: string } & Record<string, unknown> = {},
): Response {
  const { hlaska, ...data } = navic;
  const telo: ChybaOdpoved = { kod, chyba: hlaska || CHYBY[kod].hlaska };
  return Response.json({ ...data, ...telo }, { status: CHYBY[kod].status });
}

/**
 * Chyba z odpovědi serveru. Tělo se ověřuje schématem: když funkce spadne
 * nebo vyprší, Vercel nepošle náš JSON, ale vlastní stránku — pak se kód
 * odhadne ze stavu.
 */
export function chybaZOdpovedi(status: number, telo: unknown): Chyba {
  const overeno = ChybaOdpovedSchema.safeParse(telo);
  if (overeno.success) return chyba(overeno.data.kod, overeno.data.chyba);
  if (status === 401) return chyba("bez-pristupu");
  if (status === 429) return chyba("moc-pokusu");
  if (status >= 500) return chyba("server");
  if (status >= 400) return chyba("neplatny-pozadavek");
  return chyba("neznama");
}

/** Přečte tělo neúspěšné odpovědi (i když to není JSON) a vrátí chybu. */
export async function prectiChybu(odpoved: Response): Promise<Chyba> {
  return chybaZOdpovedi(odpoved.status, await odpoved.json().catch(() => null));
}

/** Chyba z výjimky — `fetch` hází jen při výpadku sítě, zbytek je neznámá chyba. */
export function chybaZVyjimky(vyjimka: unknown): Chyba {
  return chyba(vyjimka instanceof TypeError ? "sit" : "neznama");
}
