"use client";
import { useState, type FormEvent } from "react";
import { MedicineImage } from "./medicine-search";
export type StockItem = {
  id: string;
  quantity: string;
  unit: string;
  expiryDate: string | null;
  isLowStock: boolean;
  medicine: {
    name: string;
    strength: string | null;
    boxImageUrl?: string | null;
    category?: { name: string } | null;
  };
};
export type HomeData = {
  name: string;
  total: number;
  low: number;
  active: number;
  courses: { id: string; name: string; endDate: string }[];
};
export type StockFilter = "All" | "Low stock" | "Expired";
export const stockUnits = [
  "TABLET",
  "CAPSULE",
  "ML",
  "MG",
  "G",
  "DOSE",
  "SACHET",
  "AMPOULE",
  "VIAL",
  "SUPPOSITORY",
  "DROP",
  "PATCH",
  "OTHER",
];
export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function StockCards({ items }: { items: StockItem[] }) {
  return (
    <div className="card-grid">
      {items.map((item) => (
        <article className="card stack" key={item.id}>
          <MedicineImage medicine={item.medicine} />
          <span className="medicine-category">
            {item.medicine.category?.name ?? "Uncategorized"}
          </span>
          <h2>{item.medicine.name}</h2>
          <p className="muted">
            {[
              item.medicine.strength,
              `${item.quantity} ${item.unit.toLowerCase()}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="muted">
            {item.expiryDate
              ? `Expiry: ${item.expiryDate.slice(0, 10)}`
              : "Expiry not recorded"}
          </p>
          {item.isLowStock && <span className="stock-warning">Low stock</span>}
        </article>
      ))}
    </div>
  );
}
export function HomeOverview({
  data,
  go,
  openTreatment,
  disabled,
}: {
  disabled: boolean;
  data: HomeData;
  go(
    area: "My Pharmacy" | "Treatments" | "Medicines" | "Inbox",
    low?: boolean,
  ): void;
  openTreatment(id: string): void;
}) {
  return (
    <div className="stack">
      <section className="home-hero">
        <span className="eyebrow">YOUR EVERYDAY HEALTH COMPANION</span>
        <h2>Hello{data.name ? `, ${data.name}` : ""}.</h2>
        <p>
          A little care, every day. Keep your medicines and routines together.
        </p>
      </section>
      <div className="stats-grid">
        {[
          {
            label: "In pharmacy",
            value: data.total,
            area: "My Pharmacy" as const,
          },
          {
            label: "Low stock",
            value: data.low,
            area: "My Pharmacy" as const,
            low: true,
          },
          {
            label: "Active plans",
            value: data.active,
            area: "Treatments" as const,
          },
        ].map((stat) => (
          <button
            disabled={disabled}
            className="card stat-card"
            key={stat.label}
            onClick={() => go(stat.area, stat.low)}
          >
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
          </button>
        ))}
      </div>
      <h2>Your current treatments</h2>
      {data.courses.length ? (
        <div className="card-grid">
          {data.courses.map((course) => (
            <button
              disabled={disabled}
              className="card list-card"
              aria-label={`Open ${course.name}`}
              key={course.id}
              onClick={() => openTreatment(course.id)}
            >
              <h3>{course.name}</h3>
              <p className="muted">
                Review schedule · ends {course.endDate.slice(0, 10)}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <section className="card stack">
          <h3>Room for your routine</h3>
          <p className="muted">
            Your active treatment plans will appear here when available.
          </p>
        </section>
      )}
      <h2>Quick actions</h2>
      <div className="card-grid">
        <button
          disabled={disabled}
          className="card list-card"
          onClick={() => go("Medicines")}
        >
          <h3>Add medicine</h3>
          <p className="muted">Find it in the catalog</p>
        </button>
        <button
          disabled={disabled}
          className="card list-card"
          onClick={() => go("Inbox")}
        >
          <h3>My reminders</h3>
          <p className="muted">Stay up to date</p>
        </button>
      </div>
      <div className="row">
        <h2>Recently added</h2>
        <button
          disabled={disabled}
          className="quiet"
          onClick={() => go("My Pharmacy")}
        >
          View all
        </button>
      </div>
    </div>
  );
}
export function AddStock({
  medicineId,
  busy,
  disabled,
  save,
}: {
  medicineId: string;
  busy: boolean;
  disabled: boolean;
  save(body: Record<string, unknown>): void;
}) {
  const [quantity, setQuantity] = useState(""),
    [unit, setUnit] = useState(""),
    [expiry, setExpiry] = useState(""),
    [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (
      !/^\d+(\.\d{1,3})?$/.test(quantity) ||
      Number(quantity) > 999999999.999
    ) {
      setError("Enter a quantity of 0 or more, with up to 3 decimal places.");
      return;
    }
    if (!stockUnits.includes(unit)) {
      setError("Choose the unit shown on your medicine packaging.");
      return;
    }
    if (
      expiry &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(expiry) ||
        !Number.isFinite(Date.parse(expiry)) ||
        new Date(expiry).toISOString().slice(0, 10) !== expiry)
    ) {
      setError("Enter a valid expiry date as YYYY-MM-DD.");
      return;
    }
    setError("");
    save({
      medicineId,
      quantity: Number(quantity),
      unit,
      ...(expiry ? { expiryDate: expiry } : {}),
      source: "MANUAL",
    });
  }
  return (
    <form className="card stack" onSubmit={submit} noValidate>
      <h2>Add to My Pharmacy</h2>
      <p className="muted">
        Record the quantity you have. This does not change your treatment or
        dose.
      </p>
      <label>
        Stock quantity
        <input
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="e.g. 20"
          disabled={busy || disabled}
        />
      </label>
      <label>
        Stock unit
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          disabled={busy || disabled}
        >
          <option value="">Choose the packaging unit</option>
          {stockUnits.map((value) => (
            <option key={value} value={value}>
              {value.toLowerCase()}
            </option>
          ))}
        </select>
      </label>
      <label>
        Expiry date (optional)
        <input
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          type="date"
          min="0001-01-01"
          max="9999-12-31"
          disabled={busy || disabled}
        />
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button disabled={busy || disabled}>
        {busy ? "Saving…" : "Add to My Pharmacy"}
      </button>
      {disabled && (
        <p className="muted">
          Check My Pharmacy to see whether the entry was saved before adding it
          again.
        </p>
      )}
    </form>
  );
}
