import { pridejRezervaci, stavKapacity, type Stav } from "@/lib/ubytovani";

const MAX_OSOB = 10;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Pošle upozornění na e-mail přes Resend.
 * Když chybí klíč, rezervace se stejně uloží — jen se nepošle e-mail.
 */
async function posliMail(jmeno: string, pocet: number, stav: Stav): Promise<boolean> {
  const klic = process.env.RESEND_API_KEY;
  const komu = process.env.NOTIFY_EMAIL;
  const od = process.env.MAIL_FROM ?? "onboarding@resend.dev";

  if (!klic || !komu) {
    console.warn(
      "[ubytovani] E-mail neodeslán — chybí RESEND_API_KEY nebo NOTIFY_EMAIL v .env.local"
    );
    return false;
  }

  const jmenoHtml = escapeHtml(jmeno);

  try {
    const odpoved = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${klic}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: od,
        to: komu,
        subject: `Ubytování: ${jmeno} (${pocet} ${pocet === 1 ? "osoba" : "os."})`,
        html: `
          <h2 style="font-family:Georgia,serif">Nová rezervace ubytování</h2>
          <p><strong>Jméno a příjmení:</strong> ${jmenoHtml}</p>
          <p><strong>Počet osob:</strong> ${pocet}</p>
          <hr>
          <p>Obsazeno celkem: <strong>${stav.obsazeno} / ${stav.celkem}</strong>
             (volno: ${stav.volno})</p>
        `,
      }),
    });

    if (!odpoved.ok) {
      console.error("[ubytovani] Resend vrátil chybu:", odpoved.status, await odpoved.text());
      return false;
    }
    return true;
  } catch (chyba) {
    console.error("[ubytovani] E-mail se nepodařilo odeslat:", chyba);
    return false;
  }
}

/** Aktuální stav kapacity pro zobrazení na webu. */
export async function GET() {
  try {
    return Response.json(await stavKapacity());
  } catch (chyba) {
    console.error("[ubytovani] Nepodařilo se načíst kapacitu:", chyba);
    return Response.json({ chyba: "Kapacitu se nepodařilo načíst." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  let telo: unknown;
  try {
    telo = await request.json();
  } catch {
    return Response.json({ chyba: "Neplatný požadavek." }, { status: 400 });
  }

  const { jmeno, pocet, web } = (telo ?? {}) as {
    jmeno?: unknown;
    pocet?: unknown;
    web?: unknown;
  };

  // skrytá past na roboty — člověk toto pole nevyplní
  if (typeof web === "string" && web.trim() !== "") {
    return Response.json({ chyba: "Neplatný požadavek." }, { status: 400 });
  }

  const jmenoOcistene = typeof jmeno === "string" ? jmeno.trim().replace(/\s+/g, " ") : "";
  if (jmenoOcistene.length < 3 || jmenoOcistene.length > 80) {
    return Response.json({ chyba: "Vyplňte prosím jméno a příjmení." }, { status: 400 });
  }

  const pocetCislo = typeof pocet === "number" ? pocet : Number(pocet);
  if (!Number.isInteger(pocetCislo) || pocetCislo < 1 || pocetCislo > MAX_OSOB) {
    return Response.json(
      { chyba: `Zadejte počet osob od 1 do ${MAX_OSOB}.` },
      { status: 400 }
    );
  }

  let vysledek;
  try {
    vysledek = await pridejRezervaci(jmenoOcistene, pocetCislo);
  } catch (chyba) {
    console.error("[ubytovani] Rezervaci se nepodařilo uložit:", chyba);
    return Response.json(
      { chyba: "Rezervaci se nepodařilo uložit, zkuste to prosím za chvíli." },
      { status: 502 }
    );
  }

  if (!vysledek.ok) {
    return Response.json(
      {
        chyba:
          vysledek.stav.volno === 0
            ? "Kapacita ubytování je bohužel už plná."
            : `Zbývá už jen ${vysledek.stav.volno} volných míst.`,
        stav: vysledek.stav,
      },
      { status: 409 }
    );
  }

  const odeslano = await posliMail(jmenoOcistene, pocetCislo, vysledek.stav);

  return Response.json({ ok: true, stav: vysledek.stav, mailOdeslan: odeslano });
}
