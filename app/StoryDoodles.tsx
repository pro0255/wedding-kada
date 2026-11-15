"use client";

/* Odznáček „tady klikni“ v rohu hromádky fotek. Dřív tu byl ručně psaný nápis
   „klikni“ se šipkou; ikona řekne totéž beze slov a nezabere šířku půlky fotky.

   Kresba je hotový obrázek (public/ikony/klik.png) s průhledným pozadím. Bílý
   zaoblený čtverec pod ní dělá .ikona-klik-obal v CSS — odznak leží přes fotku
   a samotný obrys by se na světlém snímku ztratil. */
export function IkonaKlik() {
  return (
    <img
      className="ikona-klik"
      src="/ikony/klik.png"
      alt=""
      aria-hidden="true"
      width={512}
      height={512}
    />
  );
}
