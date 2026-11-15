"use client";

import { useEffect, useState } from "react";

/* Záloha, když nahrávání na web nejde (slabý signál, moc velké video,
   výpadek Cloudinary): fotky jde poslat do naší WhatsApp skupiny. V galerii
   je pak hosté neuvidí, ale k nám dorazí.

   Odkaz na skupinu není v kódu — repozitář je veřejný a s odkazem by se
   do skupiny přidal kdokoli. Přichází z /api/fotky jen tomu, kdo prošel
   vstupem (proměnná WHATSAPP_SKUPINA).

   Na telefonu stačí tlačítko (otevře WhatsApp). Na počítači je navíc QR,
   ať se dá naskenovat telefonem — knihovna se načte až tady. */
export default function WhatsappZaloha({ odkaz }: { odkaz: string }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    if (!window.matchMedia("(min-width: 700px) and (pointer: fine)").matches) return;
    let zivy = true;
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(odkaz, { margin: 1, width: 360, color: { dark: "#3f342b", light: "#ffffff" } }))
      .then((url) => zivy && setQr(url))
      .catch(() => {
        /* bez QR to jde taky — tlačítko zůstává */
      });
    return () => {
      zivy = false;
    };
  }, [odkaz]);

  return (
    <div className="whatsapp-zaloha" role="note">
      <p className="whatsapp-zaloha-nadpis">Nejde to nahrát?</p>
      <p>
        Pošlete fotky a videa do naší WhatsApp skupiny — projdou tam i delší videa. V galerii je
        neuvidíte, ale k nám dorazí.
      </p>
      <a className="btn whatsapp-zaloha-btn" href={odkaz} target="_blank" rel="noopener noreferrer">
        Otevřít WhatsApp skupinu
      </a>
      {qr && (
        <figure className="whatsapp-zaloha-qr">
          <img src={qr} alt="QR kód WhatsApp skupiny" width={180} height={180} />
          <figcaption>Na počítači? Naskenujte telefonem.</figcaption>
        </figure>
      )}
    </div>
  );
}
