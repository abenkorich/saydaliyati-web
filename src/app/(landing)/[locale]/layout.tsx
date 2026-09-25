import { notFound } from "next/navigation";
import { isLocale } from "@/components/landing/copy";
import "@/components/landing/landing.css";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html
      data-scroll-behavior="smooth"
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <body>{children}</body>
    </html>
  );
}
