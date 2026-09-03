"use client";

import { useState } from "react";
import type { HraSlug } from "@/lib/hra";
import Hra from "../Hra";
import Zebricek from "../Zebricek";
import Jmeno from "../Jmeno";

/** Spojuje hru, žebříček a jméno: po dohrání i po změně jména se žebříček obnoví. */
export default function HraSeZebrickem({ hra }: { hra: HraSlug }) {
  const [obnovit, setObnovit] = useState(0);
  return (
    <>
      <Hra hra={hra} onKonec={() => setObnovit((n) => n + 1)} />
      <Zebricek hra={hra} obnovit={obnovit} />
      <Jmeno onZmena={() => setObnovit((n) => n + 1)} />
    </>
  );
}
