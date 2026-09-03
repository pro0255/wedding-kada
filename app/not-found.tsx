import type { Metadata } from "next";
import Link from "next/link";
import Hra404 from "./Hra404";
import s from "./not-found.module.css";

export const metadata: Metadata = {
  title: "404 — Tady se nikdo nebere",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className={s.stranka}>
      <Hra404 />
      <Link href="/" className={s.tlacitko}>
        Zpátky na svatbu
      </Link>
    </main>
  );
}
