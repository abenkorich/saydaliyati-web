import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Landing from "@/components/landing/landing";
import { copy, isLocale, locales } from "@/components/landing/copy";
export const dynamicParams = false;
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = copy[locale];
  return {
    title: `${t.brand} — ${t.tagline}`,
    description: t.description,
    icons: { icon: "/icon-family.png", apple: "/icon-family.png" },
    alternates: { languages: { en: "/en", ar: "/ar", fr: "/fr" } },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Landing locale={locale} />;
}
