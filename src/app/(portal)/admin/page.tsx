import type { Metadata } from "next";
import { Admin } from "../../../components/admin/admin";
export const metadata: Metadata = {
  title: "Administration · Saydaliyati",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Admin />;
}
