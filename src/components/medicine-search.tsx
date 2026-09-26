"use client";
import "./medicine-search.css";
import { useEffect, useId, useState } from "react";
import type { Request } from "./prescription-model";

export type CatalogItem = {
  id: string;
  name: string;
  strength: string | null;
  dosageForm?: string | null;
  genericName?: string | null;
  boxImageUrl?: string | null;
  category?: { id: string; name: string; slug: string } | null;
};
export function MedicineImage({
  medicine,
  small = false,
}: {
  medicine: { name: string; boxImageUrl?: string | null };
  small?: boolean;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = medicine.boxImageUrl;
  return (
    <span className={`medicine-image${small ? " medicine-image-small" : ""}`}>
      {src?.startsWith("https://") && failed !== src ? (
        // External package images load in the browser, without proxying arbitrary hosts through Next.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`${medicine.name} box`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
        />
      ) : (
        <span
          className="medicine-placeholder"
          role="img"
          aria-label="Box image not available"
        >
          <svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">
            <rect
              x="9"
              y="8"
              width="30"
              height="32"
              rx="5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M9 17h30M24 23v11M18.5 28.5h11"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
          {!small && <small>No box image yet</small>}
        </span>
      )}
    </span>
  );
}
async function publicSearch<T>(path: string): Promise<{ data: T }> {
  const response = await fetch(
    `/api/medicines/suggestions${path.slice(path.indexOf("?"))}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Search unavailable");
  return response.json();
}
export function MedicineSearch({
  value,
  onChange,
  onSelect,
  api,
  category = "",
  disabled = false,
  filters = "",
  suggestionsEnabled = true,
  label = "Search medicines",
  name,
}: {
  value: string;
  onChange(value: string): void;
  onSelect(medicine: CatalogItem): void;
  api?: Request;
  category?: string;
  disabled?: boolean;
  filters?: string;
  suggestionsEnabled?: boolean;
  label?: string;
  name?: string;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [index, setIndex] = useState(-1);
  const query = value.trim();
  const key = `${category}|${filters}|${query}`;
  const [state, setState] = useState<{
    key: string;
    data: CatalogItem[];
    error: string;
    loading: boolean;
  }>({ key: "", data: [], error: "", loading: false });
  useEffect(() => {
    if (!focused || disabled || !suggestionsEnabled || query.length < 2) return;
    let current = true;
    const timer = setTimeout(() => {
      setState({ key, data: [], error: "", loading: true });
      const request = api ?? publicSearch;
      void request<CatalogItem[]>(
        `/medicines/suggestions?q=${encodeURIComponent(query)}${category ? `&category=${encodeURIComponent(category)}` : ""}${filters}`,
      )
        .then((r) => {
          if (current)
            setState({ key, data: r.data, error: "", loading: false });
        })
        .catch(() => {
          if (current)
            setState({
              key,
              data: [],
              error: "Suggestions unavailable. You can still search.",
              loading: false,
            });
        });
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [
    api,
    category,
    disabled,
    focused,
    key,
    query,
    filters,
    suggestionsEnabled,
  ]);
  const current =
    state.key === key &&
    focused &&
    !disabled &&
    suggestionsEnabled &&
    query.length >= 2;
  const results = current ? state.data : [];
  const expanded =
    current && (results.length > 0 || state.loading || !!state.error);
  function select(item: CatalogItem) {
    setFocused(false);
    setIndex(-1);
    onChange(item.name);
    onSelect(item);
  }
  return (
    <div
      className="medicine-search"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type="search"
        role="combobox"
        autoComplete="off"
        maxLength={200}
        value={value}
        disabled={disabled}
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={`${id}-options`}
        aria-activedescendant={results[index] ? `${id}-${index}` : undefined}
        placeholder="Name, ingredient, laboratory, barcode or MIPH code"
        onFocus={() => setFocused(true)}
        onChange={(e) => {
          onChange(e.target.value);
          setIndex(-1);
          setFocused(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setFocused(false);
            setIndex(-1);
          } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setFocused(true);
            setIndex((n) =>
              results.length
                ? n < 0
                  ? e.key === "ArrowDown"
                    ? 0
                    : results.length - 1
                  : (n + (e.key === "ArrowDown" ? 1 : -1) + results.length) %
                    results.length
                : -1,
            );
          } else if (e.key === "Enter" && results[index]) {
            e.preventDefault();
            select(results[index]);
          }
        }}
      />
      <div
        id={`${id}-options`}
        hidden={!expanded}
        role="listbox"
        aria-label="Medicine suggestions"
        className={
          expanded ? "medicine-suggestions" : "medicine-suggestions hidden"
        }
      >
        {results.map((m, i) => (
          <div
            id={`${id}-${i}`}
            key={m.id}
            role="option"
            aria-selected={i === index}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => select(m)}
            className="medicine-suggestion"
          >
            <MedicineImage medicine={m} small />
            <span>
              <strong>{m.name}</strong>
              <small>
                {[m.strength, m.dosageForm].filter(Boolean).join(" · ")}
              </small>
            </span>
          </div>
        ))}
      </div>
      {current && (
        <small role="status">
          {state.loading
            ? "Finding medicines…"
            : state.error || (!results.length ? "No suggestions found." : "")}
        </small>
      )}
    </div>
  );
}

export function CategoryFilter({
  api,
  value,
  onChange,
}: {
  api: Request;
  value: string;
  onChange(value: string): void;
}) {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>(
    [],
  );
  useEffect(() => {
    let current = true;
    void api<{ id: string; name: string }[]>("/medicines/categories")
      .then((r) => {
        if (current) setCategories(r.data);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [api]);
  return (
    <label className="category-filter">
      Category
      <select
        aria-label="Category"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All categories</option>
        <option value="uncategorized">Uncategorized</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
