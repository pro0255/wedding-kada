import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HRY, HraSchema } from "@/lib/schemata";
import { HRY_REGISTR } from "../hry";
import s from "../hry.module.css";
import HraSeZebrickem from "./HraSeZebrickem";

export function generateStaticParams() {
  return HRY.map((hra) => ({ hra }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hra: string }>;
}): Promise<Metadata> {
  const { hra: surova } = await params;
  const hra = HraSchema.safeParse(surova);
  if (!hra.success) return {};
  return {
    title: `${HRY_REGISTR[hra.data].nazev} · Hry · Kateřina & Jakub`,
    robots: { index: false },
  };
}

export default async function HraStranka({ params }: { params: Promise<{ hra: string }> }) {
  const { hra: surova } = await params;
  const slug = HraSchema.safeParse(surova);
  if (!slug.success) notFound();
  const hra = slug.data;
  const def = HRY_REGISTR[hra];
  return (
    <main className={s.stranka}>
      <nav className={s.drobky}>
        <Link href="/hry">← Všechny hry</Link>
      </nav>
      <h1 className={s.nadpis}>{def.nazev}</h1>
      <p className={s.popis}>{def.popis}</p>
      <HraSeZebrickem hra={hra} />
      <Link href="/" className={s.tlacitko}>
        Zpátky na svatbu
      </Link>
    </main>
  );
}
