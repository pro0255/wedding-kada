import type { NextConfig } from "next";
import { zkontrolujEnv } from "./lib/env.ts";

// bez povinných proměnných prostředí se web nespustí (dev, build i start)
zkontrolujEnv();

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // service worker se nesmí držet v cache prohlížeče — nová verze musí dojet hned
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
