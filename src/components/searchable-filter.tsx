"use client";
import { useId, useRef, useState } from "react";

export function SearchableFilter({ label, value, options, onChange }: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange(value: string): void;
}) {
  const id = useId();
  const root = useRef<HTMLDetailsElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const matches = options.filter(option => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  function close() {
    if (root.current) root.current.open = false;
    root.current?.querySelector("summary")?.focus();
  }
  return <div className="searchable-filter">
    <span className="filter-label">{label}</span>
    <details ref={root} onToggle={event => {
      if (event.currentTarget.open) { setQuery(""); input.current?.focus(); }
    }} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget) && root.current) root.current.open = false;
    }} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const buttons = Array.from(root.current?.querySelectorAll<HTMLButtonElement>(".filter-option") ?? []);
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        buttons[(current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }
    }}>
      <summary role="button" aria-label={label} aria-controls={id}>
        <span>{options.find(option => option.value === value)?.label ?? (value || "All")}</span><span aria-hidden="true">⌄</span>
      </summary>
      <div id={id} className="filter-popover">
        <input ref={input} type="search" aria-label={`Search ${label.toLowerCase()}`} placeholder="Type to filter…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
          if (event.key === "Enter") { event.preventDefault(); if (matches[0]) { onChange(matches[0].value); close(); } }
        }} />
        <div className="filter-options">
          {matches.map(option => <button type="button" key={option.value} className="filter-option" aria-pressed={option.value === value} onClick={() => { onChange(option.value); close(); }}>{option.label}{option.value === value && <span aria-hidden="true">✓</span>}</button>)}
          {!matches.length && <p role="status">No matching options.</p>}
        </div>
      </div>
    </details>
  </div>;
}
