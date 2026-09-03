import QRCode from "qrcode";
import { kresli, type Sprite } from "./hry/sprity";

/**
 * Sdílení skóre: vykreslíme obrázek (formát na Instagram story / Messenger)
 * s výsledkem, spritem hry a QR kódem na hru. Kde jde, pošleme ho přes
 * Web Share API jako soubor; jinak ho otevřeme v novém tabu k uložení.
 */
export type Sdileni = {
  nazev: string;
  jmeno: string;
  skore: number;
  jednotka: string;
  url: string; // odkaz na hru s výzvou
  sprite: Sprite;
  barvy: { ink: string; inkJemny: string; zlata: string; pozadi: string; bg: string };
};

const W = 1080;
const H = 1350;

export async function vytvorObrazek(d: Sdileni): Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = d.barvy.bg;
  ctx.fillRect(0, 0, W, H);

  // rámeček jako na oznámení
  ctx.strokeStyle = d.barvy.zlata;
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, W - 96, H - 96);

  ctx.textAlign = "center";
  ctx.fillStyle = d.barvy.inkJemny;
  ctx.font = "500 34px Jost, 'Helvetica Neue', sans-serif";
  ctx.letterSpacing = "6px";
  ctx.fillText("SVATBA KATEŘINA & JAKUB", W / 2, 150);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = d.barvy.ink;
  ctx.font = "500 72px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText(d.nazev, W / 2, 250);

  // sprite uprostřed, zvětšený
  const m = Math.floor(Math.min(520 / d.sprite[0].length, 300 / d.sprite.length));
  const sw = d.sprite[0].length * m;
  const sh = d.sprite.length * m;
  kresli(ctx, d.sprite, (W - sw) / 2, 330 + (300 - sh) / 2, d.barvy.ink, d.barvy.zlata, m);

  ctx.fillStyle = d.barvy.inkJemny;
  ctx.font = "400 40px Jost, 'Helvetica Neue', sans-serif";
  ctx.fillText(d.jmeno, W / 2, 720);

  ctx.fillStyle = d.barvy.ink;
  ctx.font = "500 190px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText(String(d.skore), W / 2, 890);
  ctx.fillStyle = d.barvy.inkJemny;
  ctx.font = "400 44px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText(d.jednotka, W / 2, 950);

  // QR vlevo dole, výzva vpravo
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, d.url, {
    width: 220,
    margin: 1,
    color: { dark: d.barvy.ink, light: d.barvy.bg },
  });
  ctx.drawImage(qr, 110, 1040);

  ctx.textAlign = "left";
  ctx.fillStyle = d.barvy.ink;
  ctx.font = "500 52px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText("Překonáš mě?", 380, 1110);
  ctx.fillStyle = d.barvy.inkJemny;
  ctx.font = "400 30px Jost, 'Helvetica Neue', sans-serif";
  ctx.fillText("Naskenuj QR nebo otevři odkaz", 380, 1160);
  ctx.fillStyle = d.barvy.zlata;
  ctx.fillText(d.url.replace(/^https?:\/\//, "").replace(/\?.*$/, ""), 380, 1205);

  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/png"),
  );
}

export type VysledekSdileni = "sdileno" | "otevreno" | "zruseno" | "chyba";

export async function sdilejSkore(d: Sdileni): Promise<VysledekSdileni> {
  let blob: Blob;
  try {
    blob = await vytvorObrazek(d);
  } catch {
    return "chyba";
  }
  const soubor = new File([blob], "skore.png", { type: "image/png" });
  const text = `${d.jmeno}: ${d.skore} ${d.jednotka} ve hře ${d.nazev}. Překonáš mě?`;
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [soubor] })) {
    try {
      await nav.share({ files: [soubor], text, url: d.url });
      return "sdileno";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "zruseno";
    }
  }
  // fallback: obrázek do nového tabu (dlouhý stisk / uložit jako) + odkaz do schránky
  try {
    await navigator.clipboard?.writeText(d.url);
  } catch {}
  const objektUrl = URL.createObjectURL(blob);
  window.open(objektUrl, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(objektUrl), 60_000);
  return "otevreno";
}
