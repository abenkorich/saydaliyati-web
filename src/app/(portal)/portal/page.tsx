import Portal from "@/components/portal";
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().replace(/\u0000/g, "").slice(0, 200) : "";
  return <Portal initialMedicineQuery={query} />;
}
