import type { Rezervace as RezervaceRadek } from "@/lib/ubytovani";
import s from "./admin.module.css";

/* Rezervace ubytování jen ke čtení. Opravy a mazání se dělají v Airtable
   (odkaz pod tabulkou) — web je jen ukazuje, aby se omylem nic neztratilo.
   Seznam je nejvýš pár minut starý, ať každé otevření správy neubírá
   z měsíčního limitu volání Airtable. */

const datum = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});
const cas = new Intl.DateTimeFormat("cs-CZ", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Prague",
});

export default function Rezervace({
  rezervace,
  ulozeno,
}: {
  rezervace: RezervaceRadek[];
  ulozeno: number;
}) {
  return (
    <div className={s.rezervace}>
      {rezervace.length === 0 ? (
        <p className={s.rezervacePrazdno}>Zatím žádná rezervace.</p>
      ) : (
        <div className={s.tabulkaObal}>
          <table className={s.tabulka}>
            <thead>
              <tr>
                <th scope="col">Jméno</th>
                <th scope="col">Osob</th>
                <th scope="col">Stav</th>
                <th scope="col">Kdy</th>
              </tr>
            </thead>
            <tbody>
              {rezervace.map((r) => (
                <tr key={r.id} className={r.status === "Zrušeno" ? s.zruseno : undefined}>
                  <td>{r.jmeno}</td>
                  <td className={s.tabulkaCislo}>{r.pocet}</td>
                  <td>{r.status || "—"}</td>
                  <td className={s.tabulkaKdy}>{datum.format(new Date(r.kdy))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={s.rezervacePoznamka}>
        Stav k {cas.format(new Date(ulozeno))} · jen ke čtení, upravuje se v Airtable.
      </p>
    </div>
  );
}
