"use client";
import { useEffect, useState } from "react";
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
    [q, setQ] = useState("");
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
  return (
    <section className="admin-panel admin-list geo-admin stack">
      <nav className="care-directory-tabs" aria-label="Geographic records">
        {(Object.keys(templates) as Kind[]).map((k) => (
          <button
            key={k}
            disabled={busy}
            aria-current={kind === k ? "page" : undefined}
            onClick={() => {
              setKind(k);
              setEdit(null);
              setCsv("");
              setPreview(null);
              setNotice("");
            }}
          >
            {k === "countries"
              ? "Countries"
              : k === "wilayas"
                ? "Wilayas / Provinces"
                : "Communes / Cities"}
          </button>
        ))}
      </nav>
      <GeoSelect
        key={revision}
        version={version}
        value={location}
        disabled={busy}
        onChange={(v) => {
          setLocation(v);
          setEdit(null);
          setPreview(null);
        }}
      />
      {error && (
        <p role="alert" className="admin-error">
          {error}{" "}
          <button onClick={() => setRevision((n) => n + 1)}>Reload</button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <p>
        Choose a country for wilayas, and a wilaya to browse communes. Codes are
        stable within their parent. Names can be edited in three languages.
      </p>
      <label>
        Search locations
        <input value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <button
        disabled={busy || (kind !== "countries" && !parentId)}
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
        Add location
      </button>
      {edit && (
        <form
          key={edit.id}
          className="stack"
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
          {(
            ["code", "nameEnglish", "nameFrench", "nameArabic", "zone"] as const
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
          <button disabled={busy}>Save location</button>
          <button type="button" disabled={busy} onClick={() => setEdit(null)}>
            Cancel
          </button>
        </form>
      )}
      {loading ? (
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
              {rows
                .filter((r) =>
                  [r.code, r.nameEnglish, r.nameFrench, r.nameArabic].some(
                    (v) => v?.toLowerCase().includes(q.toLowerCase()),
                  ),
                )
                .map((row) => (
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
          {!rows.length && <p>No locations yet.</p>}
        </div>
      )}
      <h2>Import {kind} from CSV</h2>
      <p>
        UTF-8 CSV, up to 5,000 rows / 2 MB. Existing codes update names and
        delivery fields; no records are deleted. For communes, wilayaId is the
        source wilaya code within the selected country. Preview validates the
        entire file before import.
      </p>
      <a
        download={`${kind}-template.csv`}
        href={`data:text/csv;charset=utf-8,${encodeURIComponent("\uFEFF" + templates[kind])}`}
      >
        Download CSV template
      </a>
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
        disabled={busy || !csv || (kind !== "countries" && !location.countryId)}
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
        <div className="stack">
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
    </section>
  );
}
