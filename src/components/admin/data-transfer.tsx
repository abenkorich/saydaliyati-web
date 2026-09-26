"use client";
import { useEffect, useRef, useState } from "react";
import "./data-transfer.css";
const datasets = [
  ["medicines", "Medicines"],
  ["users", "Users"],
  ["doctors", "Doctors"],
  ["pharmacies", "Pharmacies"],
  ["hospitals", "Hospitals"],
  ["settings", "Settings"],
] as const;
type Dataset = (typeof datasets)[number][0];
type Format = "json" | "csv";
type Preview = {
  valid: boolean;
  total: number;
  creates?: number;
  updates?: number;
  unchanged?: number;
  token?: string;
  issues: { row: number; field: string; message: string }[];
  rows: { row: number; operation: string; label: string }[];
};
type ExportFile = { filename: string; content: string; count: number };
const fields: Record<Dataset, string> = {
  users:
    "id, status (editable); email, phone, role, createdAt, lastLoginAt (read-only)",
  medicines: "id, name, genericName, strength, dosageForm, status, source",
  doctors:
    "id, name, specialty, licenseNumber, address, city, phone, email, status",
  pharmacies:
    "id, name, specialty, licenseNumber, address, city, phone, email, status",
  hospitals:
    "id, name, specialty, licenseNumber, address, city, phone, email, status",
  settings: "organizationName, supportEmail, defaultLanguage, timezone",
};
function download(file: ExportFile, format: Format) {
  const url = URL.createObjectURL(
    new Blob([file.content], {
      type:
        format === "csv"
          ? "text/csv;charset=utf-8"
          : "application/json;charset=utf-8",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
class TransferError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function DataTransfer({
  version,
  expired,
}: {
  version: string;
  expired: () => void;
}) {
  const [dataset, setDataset] = useState<Dataset>("medicines"),
    [format, setFormat] = useState<Format>("json"),
    [q, setQ] = useState(""),
    [file, setFile] = useState<{ name: string; content: string } | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null),
    active = useRef(true),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, []);
  const base = `/api/backend/admin/transfers/${dataset}`;
  async function request<T>(path: string, body?: unknown): Promise<T> {
    controller.current = new AbortController();
    const response = await fetch(path, {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        "X-Session-Version": version,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.any([
        controller.current.signal,
        AbortSignal.timeout(45000),
      ]),
    });
    const payload = await response.json();
    if (!response.ok)
      throw new TransferError(
        response.status,
        response.status === 404
          ? "Import and export are not available on the connected API. Deploy the data-transfer API release and its database migration, then try again."
          : (payload.error?.message ?? "Request failed."),
      );
    return payload.data as T;
  }
  function failure(e: unknown) {
    if (!active.current) return;
    if (e instanceof TransferError && [401, 403].includes(e.status)) {
      expired();
      return;
    }
    if (e instanceof TransferError && e.status === 409) setPreview(null);
    setError(e instanceof Error ? e.message : "Request failed.");
  }
  function reset(preserveFileInput = false) {
    setFile(null);
    setPreview(null);
    setError("");
    setNotice("");
    if (!preserveFileInput && input.current) input.current.value = "";
  }
  async function exportFile(template = false) {
    setBusy(template ? "template" : "export");
    setError("");
    setNotice("");
    try {
      const result = await request<ExportFile>(
        `${base}/export?format=${format}&q=${encodeURIComponent(q)}&template=${template}`,
      );
      if (!active.current) return;
      download(result, format);
      setNotice(
        template
          ? "Template downloaded. Fill in your records before uploading."
          : `Export downloaded: ${result.count.toLocaleString()} records.`,
      );
    } catch (e) {
      failure(e);
    } finally {
      if (active.current) setBusy("");
    }
  }
  async function chooseFile(selected: File | undefined) {
    reset(true);
    if (!selected) return;
    setBusy("reading");
    try {
      if (selected.size > 512 * 1024)
        throw new Error(
          "Choose a file of 512 KiB or less. Split larger imports into batches of up to 500 records.",
        );
      const extension = selected.name.split(".").pop()?.toLowerCase();
      if (extension !== "json" && extension !== "csv")
        throw new Error("Choose a .json or .csv file.");
      const content = await selected.text();
      if (!active.current) return;
      setFormat(extension);
      setFile({ name: selected.name, content });
    } catch (e) {
      failure(e);
    } finally {
      if (active.current) setBusy("");
    }
  }
  async function validate() {
    if (!file) return;
    setBusy("preview");
    setError("");
    setNotice("");
    setPreview(null);
    try {
      const result = await request<Preview>(`${base}/preview`, {
        format,
        content: file.content,
      });
      if (active.current) setPreview(result);
    } catch (e) {
      failure(e);
    } finally {
      if (active.current) setBusy("");
    }
  }
  async function apply() {
    if (!file || !preview?.valid || !preview.token) return;
    if (
      !window.confirm(
        `Import ${preview.creates ?? 0} new records and update ${preview.updates ?? 0} existing records? All changes will be applied together.`,
      )
    )
      return;
    setBusy("apply");
    setError("");
    setNotice("");
    try {
      const result = await request<{
        applied: number;
        alreadyApplied: boolean;
      }>(`${base}/apply`, {
        format,
        content: file.content,
        token: preview.token,
      });
      if (!active.current) return;
      setPreview(null);
      setFile(null);
      if (input.current) input.current.value = "";
      setNotice(
        result.alreadyApplied
          ? `This import was already completed (${result.applied} changes). No duplicates were created.`
          : `Import complete. ${result.applied} records changed.`,
      );
    } catch (e) {
      failure(e);
    } finally {
      if (active.current) setBusy("");
    }
  }
  return (
    <div className="transfer-workspace" aria-busy={!!busy}>
      <section className="admin-panel transfer-selector">
        <label>
          Data to manage
          <select
            value={dataset}
            disabled={!!busy}
            onChange={(event) => {
              setDataset(event.target.value as Dataset);
              setQ("");
              reset();
            }}
          >
            {datasets.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          File format
          <select
            value={format}
            disabled={!!busy}
            onChange={(event) => {
              setFormat(event.target.value as Format);
              reset();
            }}
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </label>
        <p>
          Move your administrative data in and out of Saydaliyati. Review every
          import before it changes your records.
        </p>
      </section>
      {error && (
        <p className="admin-error" role="alert">
          {error}
          {busy === "" && preview?.token
            ? " If the connection failed, you can retry this confirmed batch safely."
            : ""}
        </p>
      )}
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      <div className="transfer-grid">
        <section className="admin-panel">
          <span className="admin-eyebrow">EXPORT</span>
          <h2>Take your data with you</h2>
          <p>
            Download the admin fields listed below, with record IDs. Exports
            include all matching records, up to 50,000 per file.
          </p>
          {dataset !== "settings" && (
            <label>
              Filter export (optional)
              <input
                value={q}
                maxLength={100}
                disabled={!!busy}
                onChange={(event) => setQ(event.target.value)}
                placeholder={
                  dataset === "users"
                    ? "Email or phone"
                    : dataset === "medicines"
                      ? "Medicine or generic name"
                      : "Name or city"
                }
              />
            </label>
          )}
          <button disabled={!!busy} onClick={() => exportFile()}>
            {busy === "export"
              ? "Preparing download…"
              : `Download ${format.toUpperCase()}`}
          </button>
          <p className="admin-muted">
            Account exports contain no passwords, tokens or patient medical
            records.
          </p>
        </section>
        <section className="admin-panel">
          <span className="admin-eyebrow">IMPORT</span>
          <h2>Bring records into your workspace</h2>
          <p>
            Upload JSON or CSV. Maximum 512 KiB and 500 records per batch. No
            records change during preview.
          </p>
          <label>
            Choose import file
            <input
              ref={input}
              type="file"
              accept=".json,.csv,application/json,text/csv"
              disabled={!!busy}
              onChange={(event) => void chooseFile(event.target.files?.[0])}
            />
          </label>
          {file && <p className="transfer-filename">Selected: {file.name}</p>}
          <div className="transfer-actions">
            <button disabled={!file || !!busy} onClick={validate}>
              {busy === "preview" ? "Validating…" : "Preview import"}
            </button>
            <button
              className="admin-secondary"
              disabled={!!busy}
              onClick={() => exportFile(true)}
            >
              {busy === "template" ? "Preparing…" : "Download template"}
            </button>
          </div>
        </section>
      </div>
      <details className="admin-panel transfer-guide">
        <summary>Import format & matching rules</summary>
        <p>
          {dataset === "users"
            ? "Users require an existing ID. Only status can change; other exported account fields are read-only. Admin accounts are protected. Suspending or disabling an account revokes its sessions."
            : dataset === "settings"
              ? "Settings requires exactly one record. Importing replaces the administrative settings."
              : "Include an existing ID to update a record; leave ID empty or omit it to create one. Unknown IDs are rejected. Records are never matched by name or deleted."}
        </p>
        <p>
          <strong>Columns:</strong> {fields[dataset]}
        </p>
        <p>
          JSON uses an array of objects. CSV requires a header row and uses
          empty cells for optional values. Quoted commas, multiline text and
          UTF-8 are supported. Keep the column names exactly as shown.
        </p>
        <p>
          {dataset === "medicines"
            ? "New medicines require a source. Use ACTIVE, INACTIVE or ARCHIVED for status."
            : dataset === "settings"
              ? "Language must be EN, FR or AR. Use an IANA timezone, such as Africa/Algiers."
              : dataset === "users"
                ? "Editable statuses: ACTIVE, SUSPENDED, DISABLED. Existing pending accounts may be exported without changing their status."
                : "Directory statuses: DRAFT, ACTIVE, ARCHIVED. Entries do not create or verify professional accounts."}
        </p>
        <p>
          CSV exports escape spreadsheet formulas. JSON avoids
          spreadsheet-specific escaping. Export files over the import limits
          must be split into smaller batches.
        </p>
      </details>
      {preview && (
        <section
          className="admin-panel transfer-preview"
          aria-labelledby="transfer-preview-title"
        >
          <h2 id="transfer-preview-title">Import preview</h2>
          {!preview.valid ? (
            <>
              <p role="alert">
                Import cannot be applied. Fix the listed issues and upload the
                file again.
              </p>
              <div className="admin-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Record</th>
                      <th>Field</th>
                      <th>Issue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.issues.map((issue, i) => (
                      <tr key={i}>
                        <td>{issue.row || "File"}</td>
                        <td>{issue.field}</td>
                        <td>{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="transfer-counts">
                <span>
                  <strong>{preview.creates}</strong> New
                </span>
                <span>
                  <strong>{preview.updates}</strong> Updates
                </span>
                <span>
                  <strong>{preview.unchanged}</strong> Unchanged
                </span>
              </div>
              <p>
                {preview.total} records validated. Showing the first{" "}
                {preview.rows.length}. Preview expires after 15 minutes; changes
                made by another administrator require a new preview.
              </p>
              <div className="admin-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Record</th>
                      <th>Name / identifier</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.row}>
                        <td>{row.row}</td>
                        <td>{row.label}</td>
                        <td>{row.operation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                disabled={
                  !!busy || !((preview.creates ?? 0) + (preview.updates ?? 0))
                }
                onClick={apply}
              >
                {busy === "apply" ? "Applying import…" : "Confirm import"}
              </button>
            </>
          )}
        </section>
      )}
      {busy && (
        <p className="admin-muted" role="status">
          {busy === "apply"
            ? "Applying your confirmed import…"
            : busy === "preview"
              ? "Validating your file…"
              : busy === "reading"
                ? "Reading file…"
                : "Preparing your download…"}
        </p>
      )}
    </div>
  );
}
