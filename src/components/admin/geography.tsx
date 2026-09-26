"use client";
import { useEffect, useState } from "react";
import "./geography.css";
import {
  GeoSelect,
  geoRequest,
  emptyLocation,
  type GeoRow,
  type LocationValue,
} from "../geo-select";
const templates = {
  countries: "Country Code,English Name,Arabic Name,French Name\n",
  wilayas: "wilayaId,name English,Arabic Name,French Name,zone,isDeliverable\n",
  communes:
    "communeId,name,name Arabic,name French,wilayaId,wilayaName English,wilayaName Arabic,wilayaName French\n",
};
type Kind = keyof typeof templates;
type Preview = {
  valid: boolean;
  count: number;
  errors: string[];
  rows: GeoRow[];
  applied?: boolean;
};
export function Geography({ version }: { version: string }) {
  const [kind, setKind] = useState<Kind>("countries"),
    [location, setLocation] = useState<LocationValue>(emptyLocation),
    [rows, setRows] = useState<GeoRow[]>([]),
    [edit, setEdit] = useState<GeoRow | null>(null),
    [csv, setCsv] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [q, setQ] = useState(""),
    [page, setPage] = useState(1);
  const parentId =
    kind === "wilayas"
      ? location.countryId
      : kind === "communes"
        ? location.wilayaId
        : "";
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      setError("");
      try {
        const result =
          kind !== "countries" && !parentId
            ? { data: [] }
            : await geoRequest(
                `/geography/${kind}${parentId ? `?parentId=${parentId}` : ""}`,
                version,
              );
        if (active) setRows(result.data);
      } catch (e) {
        if (active) setError(String(e));
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [kind, parentId, version, revision]);
  async function work(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  const label =
    kind === "countries"
      ? "Countries"
      : kind === "wilayas"
        ? "Wilayas / Provinces"
        : "Communes / Cities";
  const singular =
    kind === "countries"
      ? "country"
      : kind === "wilayas"
        ? "wilaya"
        : "commune";
  const filtered = rows.filter((r) =>
    [r.code, r.nameEnglish, r.nameFrench, r.nameArabic].some((v) =>
      v?.toLowerCase().includes(q.trim().toLowerCase()),
    ),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const needsParent = kind !== "countries" && !parentId;
  return (
    <section className="geo-workspace">
      <nav className="geo-levels" aria-label="Geographic records">
        {(Object.keys(templates) as Kind[]).map((k) => (
          <button
            key={k}
            disabled={busy}
            aria-current={kind === k ? "page" : undefined}
            onClick={() => {
              setKind(k);
              setQ("");
              setPage(1);
              setRows([]);
              setLoading(true);
              setEdit(null);
              setCsv("");
              setPreview(null);
              setNotice("");
            }}
          >
            <span className="geo-step" aria-hidden="true">
              {k === "countries" ? "1" : k === "wilayas" ? "2" : "3"}
            </span>
            {k === "countries"
              ? "Countries"
              : k === "wilayas"
                ? "Wilayas / Provinces"
                : "Communes / Cities"}
          </button>
        ))}
      </nav>
      {kind !== "countries" && (
        <section className="admin-panel geo-scope">
          <div>
            <span className="admin-eyebrow">BROWSE BY PARENT</span>
            <h2>
              {kind === "wilayas"
                ? "Choose a country"
                : "Choose a country and wilaya"}
            </h2>
            <p>
              {kind === "wilayas"
                ? "Manage the provinces belonging to one country."
                : "Manage the communes belonging to one wilaya."}
            </p>
          </div>
          <GeoSelect
            key={revision}
            version={version}
            value={location}
            depth={kind === "wilayas" ? 1 : 2}
            disabled={busy}
            onChange={(v) => {
              setLocation(v);
              setEdit(null);
              setPreview(null);
              setQ("");
              setPage(1);
              setRows([]);
              setLoading(true);
            }}
          />
        </section>
      )}
      {error && (
        <p role="alert" className="admin-error">
          {error}{" "}
          <button onClick={() => setRevision((n) => n + 1)}>Reload</button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <section className="admin-panel geo-records">
        <div className="geo-heading">
          <div>
            <span className="admin-eyebrow">LOCATION DIRECTORY</span>
            <h2>
              {label}{" "}
              <span className="geo-count">
                {loading || needsParent ? "—" : rows.length}
              </span>
            </h2>
            <p>
              Maintain stable codes and names in English, French and Arabic.
            </p>
          </div>
          <button
            disabled={busy || needsParent || loading}
            onClick={() =>
              setEdit({
                id: "",
                kind,
                code: "",
                parentId: parentId || null,
                nameEnglish: "",
                nameFrench: null,
                nameArabic: null,
                zone: null,
                isDeliverable: null,
              })
            }
          >
            + Add {singular}
          </button>
        </div>
        <div className="geo-search">
          <label>
            Search locations
            <input
              placeholder="Search by code or name…"
              value={q}
              disabled={needsParent}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <span>
            {!needsParent && !loading
              ? `${filtered.length} matching ${filtered.length === 1 ? "location" : "locations"}`
              : loading
                ? "Loading directory…"
                : "Select a parent to begin"}
          </span>
        </div>
        {edit && (
          <form
            key={edit.id}
            className="geo-editor"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void work(async () => {
                await geoRequest(
                  `/admin/geography/${kind}${edit.id ? `/${edit.id}` : ""}`,
                  version,
                  edit.id ? "PATCH" : "POST",
                  {
                    code: String(form.get("code")),
                    parentId: edit.parentId,
                    nameEnglish: String(form.get("nameEnglish")),
                    nameFrench: form.get("nameFrench") || null,
                    nameArabic: form.get("nameArabic") || null,
                    zone: form.get("zone") || null,
                    isDeliverable:
                      form.get("isDeliverable") === ""
                        ? null
                        : form.get("isDeliverable") === "true",
                  },
                );
                setEdit(null);
                setRevision((n) => n + 1);
                setNotice("Location saved.");
              });
            }}
          >
            <div className="geo-editor-heading">
              <h3>
                {edit.id ? `Edit ${edit.nameEnglish}` : `New ${singular}`}
              </h3>
              <p>
                Code and English name are required. Existing codes stay fixed.
              </p>
            </div>
            {(
              [
                "code",
                "nameEnglish",
                "nameFrench",
                "nameArabic",
                "zone",
              ] as const
            ).map((key) => (
              <label key={key}>
                {
                  {
                    code: "Code",
                    nameEnglish: "English name",
                    nameFrench: "French name",
                    nameArabic: "Arabic name",
                    zone: "Delivery zone",
                  }[key]
                }
                <input
                  name={key}
                  defaultValue={edit[key] ?? ""}
                  required={key === "code" || key === "nameEnglish"}
                  readOnly={key === "code" && !!edit.id}
                  maxLength={key === "code" || key === "zone" ? 32 : 150}
                  disabled={busy}
                />
              </label>
            ))}
            <label>
              Deliverable
              <select
                name="isDeliverable"
                defaultValue={
                  edit.isDeliverable === null ? "" : String(edit.isDeliverable)
                }
                disabled={busy}
              >
                <option value="">Unspecified</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <div className="geo-editor-actions">
              <button disabled={busy}>Save location</button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEdit(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
        {needsParent ? (
          <div className="geo-empty">
            <h3>
              {kind === "wilayas"
                ? "Select a country to see its wilayas"
                : "Select a wilaya to see its communes"}
            </h3>
            <p>Use the parent selectors above to narrow the directory.</p>
          </div>
        ) : loading ? (
          <p role="status">Loading locations…</p>
        ) : (
          <div className="admin-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>English</th>
                  <th>French</th>
                  <th>Arabic</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td>{row.code}</td>
                    <td>{row.nameEnglish}</td>
                    <td>{row.nameFrench}</td>
                    <td dir="rtl">{row.nameArabic}</td>
                    <td>
                      <button disabled={busy} onClick={() => setEdit(row)}>
                        Edit {row.nameEnglish}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <div className="geo-empty">
                <h3>{q ? "No matching locations" : "No locations yet"}</h3>
                <p>
                  {q
                    ? "Try another code or name."
                    : `Add a ${singular} or import a CSV file below.`}
                </p>
              </div>
            )}
          </div>
        )}
        {!needsParent && filtered.length > 0 && (
          <div className="geo-pagination">
            <span>
              Showing {(currentPage - 1) * 25 + 1}–
              {Math.min(currentPage * 25, filtered.length)} of {filtered.length}
            </span>
            <div>
              <button
                disabled={currentPage <= 1 || loading}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages || loading}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
      <details className="admin-panel geo-import" key={kind}>
        <summary>
          <span>
            <strong>Import {kind} from CSV</strong>
            <small>Upload, preview and confirm a batch of locations</small>
          </span>
          <span aria-hidden="true">＋</span>
        </summary>
        <div className="geo-import-body">
          <h3>1. Prepare your file</h3>
          <p>
            UTF-8 CSV, up to 5,000 rows / 2 MB. Existing codes update names and
            delivery fields; no records are deleted. For communes, wilayaId is
            the source wilaya code within the selected country. Preview
            validates the entire file before import.
          </p>
          <a
            download={`${kind}-template.csv`}
            href={`data:text/csv;charset=utf-8,${encodeURIComponent("\uFEFF" + templates[kind])}`}
          >
            Download CSV template
          </a>
          <h3>2. Upload and preview</h3>
          {kind !== "countries" && !location.countryId && (
            <p className="geo-import-hint">
              Choose a country above before previewing an import.
            </p>
          )}
          <label>
            CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreview(null);
                setCsv("");
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) {
                  setError("CSV must be at most 2 MB.");
                  return;
                }
                void work(async () => {
                  setCsv(await file.text());
                });
              }}
            />
          </label>
          <button
            disabled={
              busy || !csv || (kind !== "countries" && !location.countryId)
            }
            onClick={() =>
              void work(async () => {
                const r = await geoRequest(
                  `/admin/geography/${kind}/preview`,
                  version,
                  "POST",
                  {
                    content: csv,
                    ...(kind !== "countries"
                      ? { countryId: location.countryId }
                      : {}),
                  },
                );
                setPreview(r.data);
              })
            }
          >
            Preview CSV
          </button>
          {preview && (
            <div className="geo-preview">
              <h3>3. Review and import</h3>
              <p role="status">
                {preview.valid
                  ? `${preview.count} valid rows ready to import.`
                  : "Import blocked. Fix the CSV and preview again."}
              </p>
              {preview.errors.map((e, i) => (
                <p role="alert" key={i}>
                  {e}
                </p>
              ))}
              <ul>
                {preview.rows.map((r, i) => (
                  <li key={i}>
                    {r.code} · {r.nameEnglish} · {r.nameFrench} · {r.nameArabic}
                  </li>
                ))}
              </ul>
              <button
                disabled={busy || !preview.valid}
                onClick={() =>
                  void work(async () => {
                    const r = await geoRequest(
                      `/admin/geography/${kind}/apply`,
                      version,
                      "POST",
                      {
                        content: csv,
                        ...(kind !== "countries"
                          ? { countryId: location.countryId }
                          : {}),
                      },
                    );
                    if (!r.data.valid) {
                      setPreview(r.data);
                      return;
                    }
                    setPreview(null);
                    setCsv("");
                    setRevision((n) => n + 1);
                    setNotice(`${r.data.count} locations imported.`);
                  })
                }
              >
                Import {preview.count} locations
              </button>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
