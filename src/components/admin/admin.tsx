"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import "./admin.css";
type Area =
  | "overview"
  | "users"
  | "medicines"
  | "doctors"
  | "pharmacies"
  | "hospitals"
  | "settings"
  | "subscriptions";
type Row = { id: string; [key: string]: string | number | null };
type Result = {
  data: Row[] | Row;
  meta?: { total?: number; totalPages?: number };
};
const areas: { key: Area; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "◫" },
  { key: "users", label: "Users", icon: "◉" },
  { key: "medicines", label: "Medicines", icon: "✚" },
  { key: "doctors", label: "Doctors", icon: "♧" },
  { key: "pharmacies", label: "Pharmacies", icon: "⊞" },
  { key: "hospitals", label: "Hospitals", icon: "▥" },
  { key: "settings", label: "Settings", icon: "⚙" },
  { key: "subscriptions", label: "Subscriptions", icon: "◇" },
];
const descriptions: Record<Area, string> = {
  overview: "A clear view of your platform and the people behind it.",
  users: "Manage account access and keep your community secure.",
  medicines: "Maintain the medicine catalog and its source information.",
  doctors: "Manage doctor contact and practice records.",
  pharmacies: "Manage your pharmacy directory.",
  hospitals: "Manage hospital and healthcare facility records.",
  settings: "Organization details and administrative defaults.",
  subscriptions:
    "A space for future plans, billing and subscription management.",
};
class ApiFailure extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
async function api(
  path: string,
  version?: string,
  method = "GET",
  data?: unknown,
  signal?: AbortSignal,
): Promise<Result> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(version ? { "X-Session-Version": version } : {}),
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiFailure(
      response.status,
      result.error?.message ?? "Request failed. Please try again.",
    );
  return result;
}
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Request failed. Please try again.";
}
export function Admin() {
  const [session, setSession] = useState<string | null>(null),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [area, setArea] = useState<Area>("overview");
  const restore = useCallback(async () => {
    try {
      const result = await api("/api/admin/session");
      setError("");
      const data = result.data as Row;
      setSession(data.authenticated ? String(data.sessionVersion) : null);
    } catch (e) {
      setSession(null);
      setError(message(e));
    } finally {
      setReady(true);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    api("/api/admin/session", undefined, "GET", undefined, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        const data = result.data as Row;
        setSession(data.authenticated ? String(data.sessionVersion) : null);
        setReady(true);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setError(message(e));
        setReady(true);
      });
    return () => controller.abort();
  }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      // Establish a fresh anonymous session if the previous session expired.
      try {
        await api("/api/admin/session");
      } catch (error) {
        if (!(error instanceof ApiFailure) || error.status !== 403) throw error;
      }
      await api("/api/auth/login", undefined, "POST", {
        identifier: form.get("email"),
        password: form.get("password"),
      });
      await restore();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/logout", undefined, "POST", {});
      setSession(null);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (!ready)
    return (
      <main className="admin-login">
        <p role="status">Checking administrator access…</p>
      </main>
    );
  if (!session)
    return (
      <main className="admin-login">
        <div className="admin-login-card">
          <Link className="admin-wordmark" href="/">
            ✚ Saydaliyati
          </Link>
          <span className="admin-eyebrow">PLATFORM ADMINISTRATION</span>
          <h1>A place to manage it all.</h1>
          <p>Sign in with your administrator account.</p>
          {error && (
            <p role="alert" className="admin-error">
              {error}
            </p>
          )}
          <form onSubmit={login}>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button disabled={busy}>
              {busy ? "Signing in…" : "Sign in to administration"}
            </button>
          </form>
          <button
            className="admin-text-button"
            onClick={restore}
            disabled={busy}
          >
            Check existing session
          </button>
          <Link href="/portal">Return to patient portal</Link>
        </div>
      </main>
    );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-wordmark">
          ✚ Saydaliyati
        </Link>
        <span className="admin-eyebrow">ADMIN WORKSPACE</span>
        <nav aria-label="Administration">
          {areas.map((item) => (
            <button
              key={item.key}
              className={area === item.key ? "active" : ""}
              aria-current={area === item.key ? "page" : undefined}
              onClick={() => setArea(item.key)}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
              {item.key === "subscriptions" && <small>Later</small>}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <span className="admin-avatar">A</span>
          <div>
            <strong>Administrator</strong>
            <small>Platform management</small>
          </div>
          <button
            aria-label="Sign out"
            title="Sign out"
            onClick={logout}
            disabled={busy}
          >
            ↗
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <span>
            Workspace <span aria-hidden="true">/</span>{" "}
            <strong>{areas.find((a) => a.key === area)?.label}</strong>
          </span>
          <span className="admin-access">● Admin access</span>
        </header>
        <div className="admin-content">
          <span className="admin-eyebrow">SAYDALIYATI MANAGEMENT</span>
          <h1>{areas.find((a) => a.key === area)?.label}</h1>
          <p className="admin-description">{descriptions[area]}</p>
          {error && (
            <p className="admin-error" role="alert">
              {error}
            </p>
          )}
          <Workspace
            key={session + area}
            area={area}
            version={session}
            navigate={setArea}
            expired={() => {
              setSession(null);
              setError(
                "Your administrator session ended. Please sign in again.",
              );
            }}
          />
        </div>
      </main>
    </div>
  );
}
type Field = {
  key: string;
  label: string;
  required?: boolean;
  options?: string[];
  type?: string;
  max?: number;
};
function fields(area: Area): Field[] {
  if (area === "users")
    return [
      {
        key: "status",
        label: "Account status",
        options: ["ACTIVE", "SUSPENDED", "DISABLED"],
      },
    ];
  if (area === "medicines")
    return [
      { key: "name", label: "Medicine name", required: true, max: 255 },
      { key: "genericName", label: "Generic name", max: 255 },
      { key: "strength", label: "Strength", max: 255 },
      { key: "dosageForm", label: "Dosage form", max: 100 },
      { key: "source", label: "Source / reference", required: true, max: 150 },
      {
        key: "status",
        label: "Catalog status",
        options: ["ACTIVE", "INACTIVE", "ARCHIVED"],
      },
    ];
  if (area === "settings")
    return [
      {
        key: "organizationName",
        label: "Organization name",
        required: true,
        max: 150,
      },
      { key: "supportEmail", label: "Support email", type: "email", max: 320 },
      {
        key: "defaultLanguage",
        label: "Administrative default language",
        options: ["EN", "FR", "AR"],
      },
      {
        key: "timezone",
        label: "Administrative default timezone",
        required: true,
        max: 64,
      },
    ];
  return [
    {
      key: "name",
      label: area === "doctors" ? "Doctor name" : "Organization name",
      required: true,
      max: 255,
    },
    {
      key: "specialty",
      label: area === "doctors" ? "Specialty" : "Services / specialty",
      max: 150,
    },
    { key: "licenseNumber", label: "License / registration number", max: 150 },
    { key: "address", label: "Address", max: 500 },
    { key: "city", label: "City", max: 100 },
    { key: "phone", label: "Phone", type: "tel", max: 32 },
    { key: "email", label: "Email", type: "email", max: 320 },
    {
      key: "status",
      label: "Directory status",
      options: ["DRAFT", "ACTIVE", "ARCHIVED"],
    },
  ];
}
function endpoint(area: Area) {
  return `/api/backend/admin/${["doctors", "pharmacies", "hospitals"].includes(area) ? "directory/" : ""}${area}`;
}
function Workspace({
  area,
  version,
  navigate,
  expired,
}: {
  area: Area;
  version: string;
  navigate: (a: Area) => void;
  expired: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [summary, setSummary] = useState<Row | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(0),
    [total, setTotal] = useState(0),
    [q, setQ] = useState(""),
    [search, setSearch] = useState(""),
    [revision, setRevision] = useState(0),
    [edit, setEdit] = useState<Row | null>(null),
    [saving, setSaving] = useState(false);
  const alive = useRef(true);
  const expireRef = useRef(expired);
  useEffect(() => {
    expireRef.current = expired;
  }, [expired]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (area === "subscriptions") return;
    const controller = new AbortController();
    api(
      endpoint(area) +
        (area === "overview" || area === "settings"
          ? ""
          : `?page=${page}&q=${encodeURIComponent(q)}`),
      version,
      "GET",
      undefined,
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        if (Array.isArray(result.data)) {
          setRows(result.data);
          setPages(result.meta?.totalPages ?? 0);
          setTotal(result.meta?.total ?? 0);
        } else setSummary(result.data);
        setLoading(false);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setLoading(false);
        if (e instanceof ApiFailure && [401, 403].includes(e.status)) {
          expireRef.current();
          return;
        }
        setError(message(e));
      });
    return () => controller.abort();
  }, [area, version, page, q, revision]);
  function reload() {
    setLoading(true);
    setError("");
    setRevision((n) => n + 1);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit) return;
    const form = new FormData(event.currentTarget);
    const data: Record<string, string | null> = {};
    for (const field of fields(area))
      data[field.key] = String(form.get(field.key) ?? "").trim() || null;
    if (
      !window.confirm(
        area === "users"
          ? "Apply this account status? Suspending or disabling will sign this user out of every session."
          : "Save these changes?",
      )
    )
      return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api(
        endpoint(area) + (edit.id && area !== "settings" ? `/${edit.id}` : ""),
        version,
        edit.id || area === "settings" ? "PATCH" : "POST",
        data,
      );
      if (!alive.current) return;
      setEdit(null);
      setNotice("Changes saved.");
      reload();
    } catch (e) {
      if (!alive.current) return;
      if (e instanceof ApiFailure && [401, 403].includes(e.status)) {
        expireRef.current();
        return;
      }
      setError(
        message(e) +
          " Reload the list to check its current state before retrying.",
      );
    } finally {
      if (alive.current) setSaving(false);
    }
  }
  if (area === "subscriptions")
    return (
      <section className="admin-planned">
        <div className="admin-planned-icon">◇</div>
        <span className="admin-tag">PLANNED</span>
        <h2>Room to grow.</h2>
        <p>Subscription management will live here when you’re ready.</p>
        <div className="admin-future">
          <span>Plans & pricing</span>
          <span>Subscription lifecycle</span>
          <span>Billing & invoices</span>
        </div>
        <p className="admin-muted">
          Billing is not enabled. No payments or subscriptions are created.
        </p>
      </section>
    );
  return (
    <>
      {error && (
        <div role="alert" className="admin-error">
          {error} {!edit && <button onClick={reload}>Try again</button>}
        </div>
      )}
      {notice && (
        <p role="status" className="admin-notice">
          {notice}
        </p>
      )}
      {loading ? (
        <div className="admin-panel admin-loading" role="status">
          Loading {area}…
        </div>
      ) : error && !edit ? null : area === "overview" ? (
        <>
          <div className="admin-metrics">
            {areas
              .filter((a) =>
                [
                  "users",
                  "medicines",
                  "doctors",
                  "pharmacies",
                  "hospitals",
                ].includes(a.key),
              )
              .map((a) => (
                <button key={a.key} onClick={() => navigate(a.key)}>
                  <span className="admin-metric-icon">{a.icon}</span>
                  <span>{a.label}</span>
                  <strong>
                    {Number(summary?.[a.key] ?? 0).toLocaleString()}
                  </strong>
                  <small>Manage {a.label.toLowerCase()} ↗</small>
                </button>
              ))}
          </div>
          <div className="admin-overview-grid">
            <section className="admin-panel">
              <span className="admin-eyebrow">YOUR WORKSPACE</span>
              <h2>Keep your platform in good shape.</h2>
              <p>
                Maintain catalog data, manage account access and organize
                healthcare contacts from one place.
              </p>
              <button onClick={() => navigate("medicines")}>
                Open medicine catalog →
              </button>
            </section>
            <section className="admin-panel">
              <span className="admin-tag">COMING LATER</span>
              <h2>Subscriptions</h2>
              <p>
                A dedicated home for plans and billing when the platform is
                ready.
              </p>
              <button
                className="admin-secondary"
                onClick={() => navigate("subscriptions")}
              >
                View roadmap →
              </button>
            </section>
          </div>
        </>
      ) : area === "settings" ? (
        <section className="admin-panel">
          <h2>Organization & preferences</h2>
          <p className="admin-muted">
            Saved administrative defaults. Existing patient language and
            treatment timezones are preserved.
          </p>
          <dl className="admin-details">
            {fields(area).map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>{String(summary?.[f.key] ?? "Not set")}</dd>
              </div>
            ))}
          </dl>
          <button onClick={() => setEdit(summary)}>Edit settings</button>
        </section>
      ) : (
        <section className="admin-panel admin-list">
          <div className="admin-list-toolbar">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setLoading(true);
                setError("");
                setPage(1);
                setQ(search.trim());
                setRevision((n) => n + 1);
              }}
            >
              <label className="admin-search">
                <span className="sr-only">Search {area}</span>
                <input
                  value={search}
                  maxLength={100}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    area === "users"
                      ? "Search email or phone…"
                      : `Search ${area}…`
                  }
                />
                <button className="admin-secondary">Search</button>
              </label>
            </form>
            {area !== "users" && (
              <button
                onClick={() => {
                  setError("");
                  setEdit({
                    id: "",
                    status: area === "medicines" ? "INACTIVE" : "DRAFT",
                  });
                }}
              >
                + Add{" "}
                {area === "pharmacies"
                  ? "pharmacy"
                  : area === "medicines"
                    ? "medicine"
                    : area === "doctors"
                      ? "doctor"
                      : "hospital"}
              </button>
            )}
          </div>
          {["doctors", "pharmacies", "hospitals"].includes(area) && (
            <p className="admin-muted">
              Directory records only. These do not create accounts or verify
              professional credentials.
            </p>
          )}
          <div className="admin-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{area === "users" ? "Account" : "Name"}</th>
                  <th>
                    {area === "users"
                      ? "Role"
                      : area === "medicines"
                        ? "Generic / strength"
                        : "City / specialty"}
                  </th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>
                        {String(
                          row.name ?? row.email ?? row.phone ?? "Account",
                        )}
                      </strong>
                      <small>
                        {String(
                          area === "users"
                            ? (row.phone ?? "")
                            : area === "medicines"
                              ? (row.dosageForm ?? "")
                              : (row.email ?? row.phone ?? ""),
                        )}
                      </small>
                    </td>
                    <td>
                      {String(
                        area === "users"
                          ? row.role
                          : area === "medicines"
                            ? [row.genericName, row.strength]
                                .filter(Boolean)
                                .join(" · ") || "—"
                            : [row.city, row.specialty]
                                .filter(Boolean)
                                .join(" · ") || "—",
                      )}
                    </td>
                    <td>
                      <span
                        className={`admin-status ${row.status === "ACTIVE" ? "is-active" : ""}`}
                      >
                        {String(row.status).replaceAll("_", " ")}
                      </span>
                    </td>
                    <td>
                      {row.role === "ADMIN" ? (
                        <small>Protected</small>
                      ) : (
                        <button
                          className="admin-secondary"
                          onClick={() => {
                            setError("");
                            setEdit(row);
                          }}
                        >
                          Edit
                          <span className="sr-only">
                            {" "}
                            {String(row.name ?? row.email ?? row.phone)}
                          </span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && (
            <div className="admin-empty">
              <h2>{q ? "No matching records" : "Nothing here yet"}</h2>
              <p>
                {q
                  ? "Try another search."
                  : area === "users"
                    ? "Registered accounts will appear here."
                    : "Add your first record to get started."}
              </p>
            </div>
          )}
          <footer className="admin-pagination">
            <span>{total.toLocaleString()} records</span>
            <div>
              <button
                className="admin-secondary"
                disabled={page <= 1}
                onClick={() => {
                  setLoading(true);
                  setPage((p) => p - 1);
                }}
              >
                Previous
              </button>
              <span>
                Page {page} of {Math.max(1, pages)}
              </span>
              <button
                className="admin-secondary"
                disabled={page >= pages}
                onClick={() => {
                  setLoading(true);
                  setPage((p) => p + 1);
                }}
              >
                Next
              </button>
            </div>
          </footer>
        </section>
      )}
      {edit && (
        <Editor
          area={area}
          row={edit}
          save={save}
          close={() => {
            if (!saving) {
              setEdit(null);
              setError("");
              reload();
            }
          }}
          saving={saving}
          error={error}
        />
      )}
    </>
  );
}
function Editor({
  area,
  row,
  save,
  close,
  saving,
  error,
}: {
  area: Area;
  row: Row;
  save: (event: FormEvent<HTMLFormElement>) => void;
  close: () => void;
  saving: boolean;
  error: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      className="admin-dialog"
      ref={dialog}
      aria-labelledby="admin-editor-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="admin-dialog-header">
        <h2 id="admin-editor-title">
          {row.id || area === "settings" ? "Edit" : "Add"}{" "}
          {area === "users"
            ? "account"
            : area === "settings"
              ? "settings"
              : area === "pharmacies"
                ? "pharmacy"
                : area.slice(0, -1)}
        </h2>
        <button
          className="admin-secondary"
          type="button"
          aria-label="Close editor"
          onClick={close}
          disabled={saving}
        >
          ×
        </button>
      </div>
      <form onSubmit={save}>
        {fields(area).map((field) => (
          <label key={field.key}>
            {field.label}
            {field.required ? " *" : ""}
            {field.options ? (
              <select
                name={field.key}
                defaultValue={String(row[field.key] ?? field.options[0])}
                disabled={saving}
              >
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={field.key}
                type={field.type ?? "text"}
                defaultValue={String(row[field.key] ?? "")}
                required={field.required}
                maxLength={field.max}
                disabled={saving}
              />
            )}
          </label>
        ))}
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-dialog-actions">
          <button
            type="button"
            className="admin-secondary"
            disabled={saving}
            onClick={close}
          >
            Cancel
          </button>
          <button disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
