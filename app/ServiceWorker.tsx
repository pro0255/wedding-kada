"use client";

import { useEffect } from "react";

/* Registrace service workeru (public/sw.js). Jen v produkci — při vývoji by
   cache schovávala změny a HMR by se s ní pral. */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* bez SW web funguje dál, jen ne offline */
    });
  }, []);
  return null;
}
