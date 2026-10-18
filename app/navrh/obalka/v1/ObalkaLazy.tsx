"use client";

import dynamic from "next/dynamic";

/* three.js + model jen v prohlížeči a mimo úvodní bundle */
const Obalka3D = dynamic(() => import("./Obalka3D"), { ssr: false });

export default function ObalkaLazy() {
  return <Obalka3D />;
}
