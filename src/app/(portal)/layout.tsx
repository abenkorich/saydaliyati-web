import type { Metadata } from "next";
import "../globals.css";
export const metadata: Metadata = {
  title: "Saydaliyati · All my medicines, in one place.",
  description: "Your medicines, treatments and reminders together.",
  icons: { icon: "/icon-family.png", apple: "/icon-family.png" },
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
