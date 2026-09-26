"use client";
import { SearchableFilter } from "./searchable-filter";
import { useEffect, useState, type ReactNode } from "react";
import type { Request } from "./prescription-model";
export type DirectoryFilters = {
  laboratory: string;
  holderCountry: string;
  dosageForm: string;
  registrationStatus: string;
};
export const emptyDirectoryFilters: DirectoryFilters = {
  laboratory: "",
  holderCountry: "",
  dosageForm: "",
  registrationStatus: "ACTIVE",
};
export function directoryParams(
  filters: DirectoryFilters,
  suggestions = false,
) {
  const params = new URLSearchParams();
  for (const key of ["laboratory", "holderCountry", "dosageForm"] as const)
    if (filters[key]) params.set(key, filters[key]);
  if (!suggestions && filters.registrationStatus !== "ACTIVE") {
    params.set("status", "ALL");
    if (filters.registrationStatus !== "ALL")
      params.set("regulatoryStatus", filters.registrationStatus);
  }
  return params.size ? `&${params}` : "";
}
export type DirectoryDetails = {
  registrationHolder?: string | null;
  holderCountry?: string | null;
  registrationNumber?: string | null;
  packageSize?: string | null;
  route?: string | null;
  status?: string;
  regulatoryStatus?: string | null;
  manufacturer?: { name: string } | null;
  sourceVersion?: string | null;
  barcodes?: { barcode: string; barcodeType: string }[];
  miph?: {
    sourceUrl: string | null;
    sheet: string | null;
    row: number | null;
    checksum: string | null;
    fields: { name: string; displayValue: string | null }[];
  } | null;
};
export function DirectoryFilterFields({
  api,
  value,
  onChange,
  children,
}: {
  children?: ReactNode;
  api: Request;
  value: DirectoryFilters;
  onChange(value: DirectoryFilters): void;
}) {
  const [options, setOptions] = useState<{
    laboratories: string[];
    countries: string[];
    dosageForms: string[];
  }>({ laboratories: [], countries: [], dosageForms: [] });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void api<typeof options>("/medicines/filters")
      .then((r) => {
        if (active) {
          setOptions(r.data);
          setFailed(false);
        }
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [api]);
  return (
    <div className="directory-filters">
      {(
        [
          [
            "laboratory",
            "Laboratory (registration holder)",
            options.laboratories,
          ],
          ["holderCountry", "Laboratory country", options.countries],
          ["dosageForm", "Dosage form", options.dosageForms],
        ] as const
      ).map(([key, label, values]) => (
        <SearchableFilter key={key} label={label} value={value[key]}
          options={[{ value: "", label: "All" }, ...(values ?? []).map(option => ({ value: option, label: option }))]}
          onChange={selected => onChange({ ...value, [key]: selected })} />
      ))}
      <SearchableFilter label="Registration status" value={value.registrationStatus}
        options={[{ value: "ACTIVE", label: "Active medicines" }, { value: "ALL", label: "All records" }, { value: "NOT_RENEWED", label: "Not renewed" }, { value: "WITHDRAWN", label: "Withdrawn" }]}
        onChange={selected => onChange({ ...value, registrationStatus: selected })} />
      <button
        type="button"
        className="secondary directory-reset"
        aria-label="Reset details filters"
        onClick={() => onChange(emptyDirectoryFilters)}
      >
        Reset
      </button>
      {children}
      {failed && (
        <small role="status">
          Filter options unavailable. You can still search by laboratory or
          other details.
        </small>
      )}
    </div>
  );
}
export function MedicineDirectoryDetails({
  medicine,
}: {
  medicine: DirectoryDetails;
}) {
  return (
    <div className="stack">
      <dl className="facts">
        {[
          ["Registration status", medicine.regulatoryStatus ?? medicine.status],
          ["Laboratory (registration holder)", medicine.registrationHolder],
          ["Laboratory country", medicine.holderCountry],
          ["Manufacturer", medicine.manufacturer?.name],
          ["Registration number", medicine.registrationNumber],
          ["Packaging", medicine.packageSize],
          ["Route", medicine.route],
          ["Source version", medicine.sourceVersion],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value ?? "Not supplied"}</dd>
          </div>
        ))}
      </dl>
      <div>
        <strong>Package barcodes</strong>
        <p>
          {medicine.barcodes?.length
            ? medicine.barcodes
                .map((b) => `${b.barcode} (${b.barcodeType})`)
                .join(" · ")
            : "No package barcode supplied. MIPH codes are nomenclature codes, not package barcodes."}
        </p>
      </div>
      {medicine.miph && (
        <details className="miph-details">
          <summary>All MIPH source fields</summary>
          <p className="muted">
            {medicine.miph.sheet} · Row {medicine.miph.row} · Version{" "}
            {medicine.sourceVersion}
          </p>
          <dl className="facts">
            {medicine.miph.fields.map((field) => (
              <div key={field.name}>
                <dt>{field.name}</dt>
                <dd>{field.displayValue ?? "Not supplied"}</dd>
              </div>
            ))}
          </dl>
          {medicine.miph.sourceUrl && (
            <a href={medicine.miph.sourceUrl} target="_blank" rel="noreferrer">
              Official MIPH source workbook
            </a>
          )}
        </details>
      )}
    </div>
  );
}
