import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/* Náhled pro sdílení (Messenger, WhatsApp, iMessage…): zvonička z úvodní
   obrazovky pod jemným béžovým závojem a jména jako na heru. Generuje se
   při buildu, hosté dostávají hotové PNG. */
export const alt = "Kateřina & Jakub — svatba 18. 9. 2027 u zvoničky v Rekovicích";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const [fotka, serif, sans] = await Promise.all([
    readFile(join(process.cwd(), "public/fotky/kaplicka.png")),
    readFile(join(process.cwd(), "app/fonty/CormorantGaramond-500.ttf")),
    readFile(join(process.cwd(), "app/fonty/Jost-400.ttf")),
  ]);
  const fotkaSrc = `data:image/png;base64,${fotka.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#f5f2ec",
          fontFamily: "Cormorant",
        }}
      >
        {/* fotka 1536×1024 zvětšená na 1200×800, posunutá o kus výš — zvonička
            i kaplička zůstanou, odřízne se jen kus trávy dole */}
        <img
          src={fotkaSrc}
          width={1200}
          height={800}
          style={{ position: "absolute", left: 0, top: -60, width: 1200, height: 800, objectFit: "cover" }}
        />
        {/* béžový závoj jako v heru, nahoře silnější — tam sedí text nad oblohou
            a horami, kaplička dole zůstává čitelná. Satori neumí `inset`,
            proto rozměry výslovně. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1200,
            height: 630,
            background:
              "linear-gradient(to bottom, rgba(245,242,236,.86) 0%, rgba(245,242,236,.62) 42%, rgba(245,242,236,.18) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1200,
            height: 630,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 62,
            color: "#2b2925",
          }}
        >
          <div
            style={{
              fontFamily: "Jost",
              fontSize: 22,
              letterSpacing: 10,
              textTransform: "uppercase",
              color: "#9e4750",
              marginBottom: 14,
            }}
          >
            Bereme se
          </div>
          <div style={{ fontSize: 112, lineHeight: 1, letterSpacing: 4 }}>Kateřina &amp; Jakub</div>
          <div
            style={{
              fontFamily: "Jost",
              fontSize: 26,
              letterSpacing: 8,
              marginTop: 22,
              color: "#4f4941",
            }}
          >
            18 · 09 · 2027 · Rekovice
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Cormorant", data: serif, weight: 500, style: "normal" },
        { name: "Jost", data: sans, weight: 400, style: "normal" },
      ],
    },
  );
}
