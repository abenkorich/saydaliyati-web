"use client";
import { useEffect, useState } from "react";
export type LocationValue = {
  countryId: string;
  wilayaId: string;
  communeId: string;
};
export const emptyLocation: LocationValue = {
  countryId: "",
  wilayaId: "",
  communeId: "",
};
export type GeoRow = {
  id: string;
  code: string;
  kind: string;
  parentId: string | null;
  nameEnglish: string;
  nameFrench: string | null;
  nameArabic: string | null;
  zone: string | null;
  isDeliverable: boolean | null;
};
export async function geoRequest(
  path: string,
  version: string,
  method = "GET",
  body?: unknown,
) {
  const response = await fetch(`/api/backend${path}`, {
    method,
    headers: {
      "X-Session-Version": version,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error?.message ?? "Unable to load locations.");
  return result;
}
export function GeoSelect({
  version,
  value,
  onChange,
  disabled = false,
}: {
  version: string;
  value: LocationValue;
  onChange(v: LocationValue): void;
  disabled?: boolean;
}) {
  return (
    <div className="geo-selects">
      {Object.entries(value).map(([name, val]) => (
        <input key={name} type="hidden" name={name} value={val} />
      ))}
      {(["countries", "wilayas", "communes"] as const).map((kind, index) => {
        const key = (["countryId", "wilayaId", "communeId"] as const)[index]!;
        const parentId =
          index === 1
            ? value.countryId
            : index === 2
              ? value.wilayaId
              : undefined;
        return (
          <GeoOption
            key={kind}
            kind={kind}
            version={version}
            parentId={parentId}
            value={value[key]}
            disabled={disabled}
            onChange={(id) =>
              onChange(
                index === 0
                  ? { countryId: id, wilayaId: "", communeId: "" }
                  : index === 1
                    ? { ...value, wilayaId: id, communeId: "" }
                    : { ...value, communeId: id },
              )
            }
          />
        );
      })}
    </div>
  );
}
function GeoOption({
  kind,
  version,
  parentId,
  value,
  onChange,
  disabled,
}: {
  kind: string;
  version: string;
  parentId?: string;
  value: string;
  onChange(id: string): void;
  disabled: boolean;
}) {
  const [state, setState] = useState<{
    rows: GeoRow[];
    error: string;
    loading: boolean;
  }>({ rows: [], error: "", loading: true });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setState({ rows: [], error: "", loading: true });
      if (kind !== "countries" && !parentId) {
        setState({ rows: [], error: "", loading: false });
        return;
      }
      try {
        const r = await geoRequest(
          `/geography/${kind}${parentId ? `?parentId=${parentId}` : ""}`,
          version,
        );
        if (active) setState({ rows: r.data, error: "", loading: false });
      } catch (e) {
        if (active)
          setState({
            rows: [],
            error: e instanceof Error ? e.message : "Locations unavailable",
            loading: false,
          });
      }
    });
    return () => {
      active = false;
    };
  }, [kind, parentId, version, retry]);
  const label =
    kind === "countries"
      ? "Country"
      : kind === "wilayas"
        ? "Wilaya / Province"
        : "Commune / City";
  return (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        disabled={
          disabled ||
          state.loading ||
          !!state.error ||
          (kind !== "countries" && !parentId)
        }
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {state.loading
            ? "Loading…"
            : `All / unspecified ${label.toLowerCase()}`}
        </option>
        {state.rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.code} · {row.nameEnglish}
            {row.nameArabic ? ` · ${row.nameArabic}` : ""}
          </option>
        ))}
      </select>
      {state.error && (
        <span role="alert">
          {state.error}{" "}
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Retry locations
          </button>
        </span>
      )}
    </label>
  );
}
