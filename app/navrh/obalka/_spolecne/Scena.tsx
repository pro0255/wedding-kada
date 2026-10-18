import Link from "next/link";
import s from "./scena.module.css";

/* Kompozice D1 pro posouzení návrhů: vlevo hromádka polaroidů (zástupné
   fotky z webu), vpravo dole obálka, která přesahuje roh hromádky asi o 20 %
   a je pootočená o +4°. Obálku dodá konkrétní verze jako children.

   Květiny jsou skutečné svatební (public/kytky, výřezy s průhledností) a jdou
   v plných barvách — žádné filtry na sytost. Kytice leží ZA průsečíkem fotek
   a obálky a vykukuje kolem něj; před scénou jsou jen dvě snítky v rozích
   (roh obálky a spodní rám polaroidu), nikdy přes obličeje ani text dopisu. */
const FOTKY = [
  { src: "/fotky/web/2.webp", w: 900, h: 675, r: -7, x: 0, y: 4 },
  { src: "/fotky/web/4.webp", w: 900, h: 675, r: 5, x: 6, y: 0 },
  { src: "/fotky/web/1.webp", w: 675, h: 900, r: -2, x: 3, y: 2 },
];

// kytice za průsečíkem — pořadí = pořadí vrstev (první nejvíc vzadu)
const ZA = [
  { src: "/kytky/12_ostrozka_modra.webp", w: 152, h: 560, c: s.kvOstrozkaModra },
  { src: "/kytky/15_ostrozka_ruzova.webp", w: 195, h: 560, c: s.kvOstrozkaRuzova },
  { src: "/kytky/04_gypsophila.webp", w: 357, h: 560, c: s.kvGypsophila },
  { src: "/kytky/6_pomnenky.webp", w: 271, h: 560, c: s.kvPomnenky },
  { src: "/kytky/5_gerbera.webp", w: 560, h: 531, c: s.kvGerberaZluta },
  { src: "/kytky/8_pivonka.webp", w: 355, h: 378, c: s.kvPivonka },
  { src: "/kytky/06_hortenzie.webp", w: 514, h: 440, c: s.kvHortenzie },
  { src: "/kytky/pivonka_zluta (1).webp", w: 528, h: 560, c: s.kvPivonkaZluta },
  { src: "/kytky/4_karafiat_broskvovy.webp", w: 555, h: 560, c: s.kvKarafiatBroskvovy },
  { src: "/kytky/10_gerbera.webp", w: 560, h: 550, c: s.kvGerbera },
  { src: "/kytky/1_karafiat_ruzovy.webp", w: 560, h: 557, c: s.kvKarafiatRuzovy },
];

// snítky před scénou: u obálky (verze s vlastní 3D snítkou je vypne) a u polaroidu
const PRED_OBALKOU = [
  { src: "/kytky/07_hermanek.webp", w: 442, h: 560, c: s.kvHermanek },
  { src: "/kytky/3_krasenka_modra.webp", w: 443, h: 448, c: s.kvKrasenka },
];
const PRED_FOTKAMI = [{ src: "/kytky/11_ruze.webp", w: 451, h: 560, c: s.kvRuze }];

function Kvetina({ src, w, h, c }: { src: string; w: number; h: number; c: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={`${s.kv} ${c}`} src={encodeURI(src)} width={w} height={h} alt="" loading="lazy" decoding="async" />
  );
}

export default function Scena({
  nazev,
  popis,
  children,
  kytkyPredObalkou = true,
}: {
  nazev: string;
  popis: string;
  children: React.ReactNode;
  /* false = verze kreslí snítku u obálky sama (V1 ve 3D se skutečným stínem) */
  kytkyPredObalkou?: boolean;
}) {
  return (
    <main className={s.stranka}>
      <header className={s.hlavicka}>
        <Link href="/navrh" className={s.zpet}>
          ← všechny návrhy
        </Link>
        <h1 className={s.nazev}>{nazev}</h1>
        <p className={s.popis}>{popis}</p>
      </header>

      <section className={s.scena} aria-label="Náš příběh — ukázka kompozice">
        <div className={s.za} aria-hidden="true">
          {ZA.map((k) => (
            <Kvetina key={k.src} {...k} />
          ))}
        </div>

        <div className={s.hromadka} aria-hidden="true">
          {FOTKY.map((f, i) => (
            <figure
              key={f.src}
              className={s.polaroid}
              style={{
                transform: `translate(${f.x}%, ${f.y}%) rotate(${f.r}deg)`,
                zIndex: i,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.src} width={f.w} height={f.h} alt="" loading="lazy" decoding="async" />
            </figure>
          ))}
        </div>

        <div className={s.slotObalky}>{children}</div>

        <div className={s.pred} aria-hidden="true">
          {kytkyPredObalkou && PRED_OBALKOU.map((k) => <Kvetina key={k.src} {...k} />)}
          {PRED_FOTKAMI.map((k) => (
            <Kvetina key={k.src} {...k} />
          ))}
        </div>
      </section>
    </main>
  );
}
