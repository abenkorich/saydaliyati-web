"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MedicineSearch } from "../medicine-search";
export function DirectorySearch({ label }: { label: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  return (
    <MedicineSearch
      name="q"
      label={label}
      value={query}
      onChange={setQuery}
      onSelect={(m) => {
        router.push(`/portal?q=${encodeURIComponent(m.name)}`);
      }}
    />
  );
}
