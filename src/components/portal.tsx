"use client";
import {
  HealthcareDirectory,
  isDirectoryArea,
  type DirectoryArea,
} from "./healthcare-directory";
import {
  DirectoryFilterFields,
  MedicineDirectoryDetails,
  directoryParams,
  emptyDirectoryFilters,
  type DirectoryDetails,
} from "./medicine-directory";

import Image from "next/image";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  AddStock,
  HomeOverview,
  StockCards,
  localDate,
  type HomeData,
  type StockFilter,
  type StockItem,
} from "./pharmacy";

import {
  MedicineImage,
  MedicineSearch,
  CategoryFilter,
} from "./medicine-search";
import { Prescriptions } from "./prescriptions";
import type { Request as PrescriptionRequest } from "./prescription-model";

type Area =
  | DirectoryArea
  | "Prescriptions"
  | "Home"
  | "My Pharmacy"
  | "More"
  | "Treatments"
  | "Medicines"
  | "Inbox"
  | "Settings";
type Medicine = DirectoryDetails & {
  boxImageUrl?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  id: string;
  name: string;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  description?: string | null;
  source?: string | null;
};
type Treatment = {
  id: string;
  name: string;
  status: string;
  startDate: string;
  endDate: string;
};
type Occurrence = {
  occurrenceId: string;
  scheduledAt: string;
  timezone: string;
  eligible: boolean;
  event: { status: string } | null;
};
type TreatmentDetail = Treatment & {
  medications: {
    id: string;
    medicineId: string;
    dose: string;
    doseUnit: string;
    instructions: string | null;
    schedules: { id: string; occurrences: Occurrence[] }[];
  }[];
};
type Notice = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  data: { treatmentId: string };
};
type Flags = {
  doseReminders: boolean;
  expiryReminders: boolean;
  lowStockAlerts: boolean;
  sharingNotifications: boolean;
  systemNotifications: boolean;
};
type SessionState = {
  authenticated: boolean;
  sessionVersion?: string;
  role?: string;
};
type Result<T> = { data: T; meta?: { totalPages?: number; total?: number } };
type View =
  | { kind: "list" }
  | { kind: "treatment"; id: string }
  | { kind: "medicine"; id: string; treatmentId?: string };
const defaults: Flags = {
  doseReminders: false,
  expiryReminders: false,
  lowStockAlerts: false,
  sharingNotifications: false,
  systemNotifications: false,
};
const labels: Record<keyof Flags, string> = {
  doseReminders: "Dose reminders",
  expiryReminders: "Expiry reminders",
  lowStockAlerts: "Low stock alerts",
  sharingNotifications: "Sharing updates",
  systemNotifications: "System updates",
};
class RequestError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
  sessionVersion?: string | null,
): Promise<Result<T>> {
  if (path.startsWith("/api/backend/") && !sessionVersion)
    throw new RequestError(401, "AUTH_SESSION_EXPIRED");
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      ...(body === undefined || body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(path.startsWith("/api/backend/") && sessionVersion
        ? { "X-Session-Version": sessionVersion }
        : {}),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new RequestError(
      response.status,
      result?.error?.code ?? "REQUEST_FAILED",
    );
  return result as Result<T>;
}
function message(error: unknown) {
  if (!(error instanceof RequestError))
    return "Connection interrupted. Please try again.";
  const known: Record<string, string> = {
    AUTH_INVALID_CREDENTIALS: "Check your email or phone and password.",
    VALIDATION_ERROR: "Check your entries and try again.",
    AUTH_RATE_LIMITED: "Too many attempts. Please wait before trying again.",
    RESOURCE_NOT_FOUND: "This item is no longer available.",
  };
  return (
    known[error.code] ??
    (error.status === 401
      ? "Your session has ended. Please sign in again."
      : `Request could not be completed (${error.code}).`)
  );
}
function when(value: string, timezone?: string) {
  try {
    return new Date(value).toLocaleString(
      "en",
      timezone ? { timeZone: timezone } : undefined,
    );
  } catch {
    return value;
  }
}
function Demo({ medicine }: { medicine: Medicine }) {
  return /demo|synthetic/i.test(`${medicine.name} ${medicine.source ?? ""}`) ? (
    <span className="badge">DEMO · Synthetic</span>
  ) : null;
}
function MedicineCard({ medicine }: { medicine: Medicine }) {
  return (
    <section className="card stack">
      <MedicineImage medicine={medicine} />
      <span className="medicine-category">
        {medicine.category?.name ?? "Uncategorized"}
      </span>
      <Demo medicine={medicine} />
      <h2>{medicine.name}</h2>
      <dl className="facts">
        {[
          ["Generic name", medicine.genericName],
          ["Strength", medicine.strength],
          ["Dosage form", medicine.dosageForm],
          ["Source", medicine.source],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value ?? "Not supplied"}</dd>
          </div>
        ))}
      </dl>
      <MedicineDirectoryDetails medicine={medicine} />
      <p>{medicine.description ?? "No description supplied."}</p>
    </section>
  );
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card empty">
      <span className="empty-symbol" aria-hidden="true">
        ＋
      </span>
      <h2>{title}</h2>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}

export default function Portal({
  initialMedicineQuery = "",
}: {
  initialMedicineQuery?: string;
}) {
  const pendingMedicineQuery = useRef(initialMedicineQuery);
  const [stock, setStock] = useState<StockItem[]>([]),
    [stockTotal, setStockTotal] = useState(0),
    [stockFilter, setStockFilter] = useState<StockFilter>("All"),
    [home, setHome] = useState<HomeData | null>(null),
    [stockUncertain, setStockUncertain] = useState(false),
    [quickOpen, setQuickOpen] = useState(false);
  const quickDialog = useRef<HTMLDialogElement>(null);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [session, setSession] = useState<
    "checking" | "signed-in" | "signed-out"
  >("checking");
  const [area, setArea] = useState<Area>("Home"),
    [view, setView] = useState<View>({ kind: "list" });
  const [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [register, setRegister] = useState(false),
    [identifier, setIdentifier] = useState(""),
    [password, setPassword] = useState(""),
    [firstName, setFirstName] = useState(""),
    [lastName, setLastName] = useState("");
  const [resultView, setResultView] = useState<"grid" | "list">("grid");
  const [gridColumns, setGridColumns] = useState(4);
  const [listColumns, setListColumns] = useState(1);
  const [category, setCategory] = useState("");
  const [directoryFilters, setDirectoryFilters] = useState(
    emptyDirectoryFilters,
  );
  const [search, setSearch] = useState(""),
    [term, setTerm] = useState(""),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [revision, setRevision] = useState(0);
  const [medicines, setMedicines] = useState<Medicine[]>([]),
    [treatments, setTreatments] = useState<Treatment[]>([]),
    [notices, setNotices] = useState<Notice[]>([]),
    [treatment, setTreatment] = useState<TreatmentDetail | null>(null),
    [medicine, setMedicine] = useState<Medicine | null>(null);
  const [flags, setFlags] = useState<Flags>(defaults),
    [configured, setConfigured] = useState(false),
    [preferencesLoaded, setPreferencesLoaded] = useState(false),
    [dirty, setDirty] = useState(false);
  const [confirmation, setConfirmation] = useState<{
      occurrence: Occurrence;
      status: "TAKEN" | "SKIPPED";
    } | null>(null),
    [recordUncertain, setRecordUncertain] = useState(false);
  const sessionVersion = useRef<string | null>(null);
  const [visibleSessionVersion, setVisibleSessionVersion] = useState<
    string | null
  >(null);
  const backend = useCallback(
    <T,>(path: string, method = "GET", body?: unknown, signal?: AbortSignal) =>
      request<T>(path, method, body, signal, sessionVersion.current),
    [],
  );
  const prescriptionApi: PrescriptionRequest = useCallback(
    <T,>(path: string, method = "GET", body?: unknown) =>
      backend<T>(`/api/backend${path}`, method, body),
    [backend],
  );
  const generation = useRef(0),
    actionLock = useRef(false),
    dirtyRef = useRef(false),
    channel = useRef<BroadcastChannel | null>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const openPendingSearch = useCallback(() => {
    if (!pendingMedicineQuery.current) return;
    setSearch(pendingMedicineQuery.current);
    setTerm(pendingMedicineQuery.current);
    setArea("Medicines");
    pendingMedicineQuery.current = "";
  }, []);
  const clearPrivate = useCallback(() => {
    generation.current++;
    setStock([]);
    setStockTotal(0);
    setStockFilter("All");
    setHome(null);
    setStockUncertain(false);
    setQuickOpen(false);
    sessionVersion.current = null;
    setVisibleSessionVersion(null);
    setFieldErrors({});
    setMedicines([]);
    setTreatments([]);
    setNotices([]);
    setTreatment(null);
    setMedicine(null);
    setFlags(defaults);
    setConfigured(false);
    setPreferencesLoaded(false);
    setDirty(false);
    dirtyRef.current = false;
    setConfirmation(null);
    setPassword("");
    setFirstName("");
    setLastName("");
    setIdentifier("");
    setSearch("");
    setTerm("");
    setPage(1);
    setPages(1);
    setView({ kind: "list" });
    setArea("Home");
    setSuccess("");
    setLoading(false);
    setRecordUncertain(false);
  }, []);
  const restore = useCallback(async () => {
    const epoch = generation.current;
    try {
      const result = await request<SessionState>("/api/session");
      if (epoch === generation.current) {
        if (result.data.role === "ADMIN") {
          window.location.replace("/admin");
          return;
        }
        if (result.data.authenticated && !result.data.sessionVersion)
          throw new RequestError(503, "SERVICE_UNAVAILABLE");
        sessionVersion.current = result.data.sessionVersion ?? null;
        setVisibleSessionVersion(result.data.sessionVersion ?? null);
        if (result.data.authenticated) {
          setLogoutFailed(false);
          openPendingSearch();
        }
        setSession(result.data.authenticated ? "signed-in" : "signed-out");
        setError("");
      }
    } catch (e) {
      if (epoch === generation.current) {
        if (e instanceof RequestError && e.status === 401)
          setSession("signed-out");
        else setError(message(e));
      }
    }
  }, [openPendingSearch]);
  const report = useCallback(
    (e: unknown) => {
      if (
        e instanceof RequestError &&
        e.status === 401 &&
        (session === "signed-in" || e.code === "AUTH_SESSION_EXPIRED")
      ) {
        if (session === "signed-in") {
          clearPrivate();
          channel.current?.postMessage("session-changed");
        }
        setSession("checking");
        void restore();
      }
      setError(message(e));
    },
    [clearPrivate, restore, session],
  );
  // Session bootstrap synchronizes external HttpOnly state; restore updates state after its HTTP response.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void restore();
    if (typeof BroadcastChannel !== "undefined") {
      const bus = new BroadcastChannel("saydaliyati-session");
      channel.current = bus;
      bus.onmessage = () => {
        clearPrivate();
        setSession("checking");
        void restore();
      };
      return () => {
        bus.close();
        channel.current = null;
      };
    }
  }, [restore, clearPrivate]);
  useEffect(() => {
    const refresh = () => {
      if (
        document.visibilityState !== "hidden" &&
        !dirtyRef.current &&
        !actionLock.current &&
        !logoutFailed
      ) {
        if (session === "signed-in") setRevision((n) => n + 1);
        else void restore();
      }
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [restore, session, logoutFailed]);
  useEffect(() => {
    if (quickOpen) quickDialog.current?.showModal();
    else quickDialog.current?.close();
  }, [quickOpen]);
  useEffect(() => {
    if (confirmation) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirmation]);
  useEffect(() => {
    if (session !== "signed-in" || (area === "Settings" && dirtyRef.current))
      return;
    const epoch = generation.current,
      controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    const load = async () => {
      const valid = () => active && epoch === generation.current;
      const api = <T,>(path: string) =>
        backend<T>(`/api/backend${path}`, "GET", undefined, controller.signal);
      if (view.kind === "treatment") {
        const r = await api<TreatmentDetail>(
          `/me/treatments/${encodeURIComponent(view.id)}`,
        );
        if (valid()) {
          setTreatment(r.data);
          setRecordUncertain(false);
        }
      } else if (view.kind === "medicine") {
        const r = await api<Medicine>(
          `/medicines/${encodeURIComponent(view.id)}`,
        );
        if (valid()) setMedicine(r.data);
      } else if (area === "Home" || area === "My Pharmacy") {
        const homeScreen = area === "Home";
        const r = await api<StockItem[]>(
          `/me/inventory?page=${homeScreen ? 1 : page}&limit=${homeScreen ? 3 : 20}&sort=created_desc${!homeScreen && stockFilter === "Low stock" ? "&lowStock=true" : ""}${!homeScreen && stockFilter === "Expired" ? `&expiryBefore=${localDate(new Date())}` : ""}`,
        );
        const [profile, low, plans] = homeScreen
          ? await Promise.all([
              api<{ firstName: string }>("/me/profile"),
              api<StockItem[]>("/me/inventory?limit=1&lowStock=true"),
              api<Treatment[]>("/me/treatments?limit=3&status=ACTIVE"),
            ])
          : [null, null, null];
        if (valid()) {
          setStock(r.data);
          setStockTotal(r.meta?.total ?? r.data.length);
          setPages(Math.max(1, r.meta?.totalPages ?? 1));
          if (homeScreen)
            setHome({
              name: profile?.data.firstName ?? "",
              total: r.meta?.total ?? r.data.length,
              low: low?.meta?.total ?? 0,
              active: plans?.meta?.total ?? 0,
              courses: plans?.data ?? [],
            });
        }
      } else if (
        area === "More" ||
        area === "Prescriptions" ||
        isDirectoryArea(area)
      ) {
        return;
      } else if (area === "Settings") {
        const r = await api<{ configured: boolean; preferences: Flags | null }>(
          "/me/notification-preferences",
        );
        if (valid() && !dirtyRef.current) {
          const saved = r.data.preferences;
          // Submit only the five choices this screen edits, preserving API-only fields.
          setFlags(
            saved
              ? {
                  doseReminders: saved.doseReminders,
                  expiryReminders: saved.expiryReminders,
                  lowStockAlerts: saved.lowStockAlerts,
                  sharingNotifications: saved.sharingNotifications,
                  systemNotifications: saved.systemNotifications,
                }
              : defaults,
          );
          setConfigured(r.data.configured);
          setPreferencesLoaded(true);
        }
      } else {
        const path =
          area === "Treatments"
            ? "/me/treatments"
            : area === "Inbox"
              ? "/me/notifications"
              : "/medicines";
        const r = await api<Medicine[] | Treatment[] | Notice[]>(
          `${path}?page=${page}&limit=20${area === "Medicines" && term && term !== "*" ? `&q=${encodeURIComponent(term)}` : ""}${area === "Medicines" && category ? `&category=${encodeURIComponent(category)}` : ""}${area === "Medicines" ? directoryParams(directoryFilters) : ""}`,
        );
        if (valid()) {
          setPages(Math.max(1, r.meta?.totalPages ?? 1));
          if (area === "Treatments") setTreatments(r.data as Treatment[]);
          else if (area === "Inbox") setNotices(r.data as Notice[]);
          else setMedicines(r.data as Medicine[]);
        }
      }
    };
    void load()
      .catch((e) => {
        if (active && epoch === generation.current) report(e);
      })
      .finally(() => {
        if (active && epoch === generation.current) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    session,
    area,
    view,
    page,
    term,
    category,
    directoryFilters,
    revision,
    report,
    backend,
    stockFilter,
  ]);
  function navigate(next: View, nextArea = area) {
    generation.current++;
    setView(next);
    setArea(nextArea);
    setTreatment(null);
    setMedicine(null);
    setError("");
    setSuccess("");
    setConfirmation(null);
    setStockUncertain(false);
    setQuickOpen(false);
  }
  function switchArea(next: Area) {
    if (actionLock.current) return;
    navigate({ kind: "list" }, next);
    setPage(1);
    setStock([]);
    setHome(null);
  }
  async function action(work: (valid: () => boolean) => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    const epoch = generation.current;
    try {
      await work(() => epoch === generation.current);
    } catch (e) {
      if (epoch === generation.current) report(e);
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  }
  function signIn(event: FormEvent) {
    event.preventDefault();
    const validation: Record<string, string> = {};
    if (register) {
      if (!firstName.trim()) validation.firstName = "Enter your first name.";
      else if (firstName.trim().length > 100)
        validation.firstName = "First name must be 100 characters or fewer.";
      if (!lastName.trim()) validation.lastName = "Enter your last name.";
      else if (lastName.trim().length > 100)
        validation.lastName = "Last name must be 100 characters or fewer.";
      if (Array.from(password).length < 15)
        validation.password =
          "Your password is too short. Use at least 15 characters.";
      else if (Array.from(password).length > 128)
        validation.password =
          "Your password is too long. Use no more than 128 characters.";
      else if (/[\uD800-\uDFFF]/u.test(password))
        validation.password =
          "Your password contains an unsupported character.";
    }
    if (!identifier.trim())
      validation.identifier = "Enter your email or international phone number.";
    else if (
      identifier.trim().startsWith("+") &&
      !/^\+[1-9][0-9]{1,14}$/.test(identifier.trim())
    )
      validation.identifier =
        "Use an international phone number starting with + and its country code.";
    else if (
      !identifier.trim().startsWith("+") &&
      (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier.trim()) ||
        identifier.trim().length > 320)
    )
      validation.identifier =
        "Enter a valid email address or an international phone number starting with +.";
    if (!password && !register) validation.password = "Enter your password.";
    setFieldErrors(validation);
    if (Object.keys(validation).length) return;
    void action(async (valid) => {
      const id = identifier.trim();
      const result = await request<SessionState>(
        "/api/auth/" + (register ? "register" : "login"),
        "POST",
        register
          ? {
              ...(id.startsWith("+") ? { phone: id } : { email: id }),
              password,
              firstName,
              lastName,
              preferredLanguage: "EN",
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }
          : { identifier: id, password },
      ).catch((error: unknown) => {
        if (
          register &&
          error instanceof RequestError &&
          ["VALIDATION_ERROR", "REGISTRATION_UNAVAILABLE"].includes(error.code)
        ) {
          if (valid())
            setError(
              "We couldn’t create your account with these details. Enter your first and last name (up to 100 characters each), a valid email address or a phone number with its country code (for example, +213555123456), and a password of 15–128 characters. If you’ve signed up before, select ‘I already have an account’ to sign in. If everything looks correct, try again later.",
            );
          return null;
        }
        throw error;
      });
      if (!result) return;
      if (valid()) {
        if (result.data.role === "ADMIN") {
          channel.current?.postMessage("session-changed");
          window.location.replace("/admin");
          return;
        }
        if (result.data.role && result.data.role !== "PATIENT") {
          await request("/api/auth/logout", "POST", {});
          clearPrivate();
          setSession("signed-out");
          setError(
            "This portal requires a patient account. Sign in with a patient account to manage your pharmacy and treatments.",
          );
          channel.current?.postMessage("session-changed");
          return;
        }
        if (!result.data.authenticated || !result.data.sessionVersion)
          throw new RequestError(503, "SERVICE_UNAVAILABLE");
        clearPrivate();
        openPendingSearch();
        sessionVersion.current = result.data.sessionVersion;
        setVisibleSessionVersion(result.data.sessionVersion);
        setLogoutFailed(false);
        setSession("signed-in");
        channel.current?.postMessage("session-changed");
      }
    });
  }
  function logout() {
    void action(async () => {
      clearPrivate();
      const epoch = generation.current;
      setSession("checking");
      try {
        await request("/api/auth/logout", "POST", {});
        if (epoch === generation.current) setLogoutFailed(false);
      } catch (e) {
        if (epoch === generation.current) {
          setLogoutFailed(true);
          setError(
            `${message(e)} Sign-out could not be confirmed. Close this browser or retry sign-out before leaving a shared device.`,
          );
        }
      } finally {
        if (epoch === generation.current) {
          setSession("signed-out");
          channel.current?.postMessage("session-changed");
        }
      }
    });
  }
  function confirmRecord() {
    if (!confirmation || !treatment) return;
    const chosen = confirmation;
    setConfirmation(null);
    void action(async (valid) => {
      try {
        await backend("/api/backend/me/medication-events", "POST", {
          occurrenceId: chosen.occurrence.occurrenceId,
          status: chosen.status,
        });
        if (valid()) {
          setSuccess(`Dose recorded as ${chosen.status.toLowerCase()}.`);
          setRevision((n) => n + 1);
        }
      } catch (e) {
        if (valid()) {
          setRecordUncertain(true);
          setError(
            `${message(e)} The result may be uncertain. Refresh this treatment to check the record before attempting another action.`,
          );
        }
        if (e instanceof RequestError && e.status === 401) throw e;
      }
    });
  }
  const listVisible = view.kind === "list";
  return (
    <div className="portal">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Image
              src="/icon-family.png"
              alt=""
              width={46}
              height={46}
              sizes="46px"
            />
          </span>
          <div>
            <span className="brand-name">Saydaliyati</span>
            <p>All my medicines, in one place.</p>
          </div>
        </div>
        {session === "signed-in" && (
          <div className="header-shortcuts">
            <button
              className="quiet"
              disabled={busy}
              onClick={() => switchArea("Inbox")}
            >
              Inbox
            </button>
            <button
              className="quiet"
              disabled={busy}
              onClick={() => switchArea("Settings")}
            >
              Settings
            </button>
          </div>
        )}
        {session === "signed-in" && area !== "Settings" && (
          <button
            className="quiet desktop-signout"
            disabled={busy}
            onClick={logout}
          >
            Sign out
          </button>
        )}
      </header>
      {session === "signed-in" && (
        <nav aria-label="Main navigation" className="navigation">
          {(
            [
              "Home",
              "My Pharmacy",
              "Treatments",
              "Medicines",
              "Hospitals",
              "Inbox",
              "Settings",
              "More",
            ] as Area[]
          ).map((item) => (
            <button
              key={item}
              aria-current={
                area === item || (item === "Hospitals" && isDirectoryArea(area))
                  ? "page"
                  : undefined
              }
              disabled={busy}
              onClick={() => switchArea(item)}
            >
              {item === "Hospitals" ? "Care directory" : item}
            </button>
          ))}
        </nav>
      )}
      <main
        id="main"
        className={
          session === "signed-out" ? "content auth-content" : "content"
        }
      >
        {error && (
          <div className="error stack" role="alert">
            <p>{error}</p>
            {session === "checking" ? (
              <button className="secondary" onClick={() => void restore()}>
                Retry session check
              </button>
            ) : session === "signed-in" ? (
              <button
                className="secondary"
                disabled={busy || (area === "Settings" && dirty)}
                onClick={() => setRevision((n) => n + 1)}
              >
                Refresh and retry loading
              </button>
            ) : logoutFailed ? (
              <button className="secondary" disabled={busy} onClick={logout}>
                Retry sign out
              </button>
            ) : null}
          </div>
        )}
        {success && (
          <p className="success" role="status">
            {success}
          </p>
        )}
        {session === "checking" ? (
          <div className="card empty" role="status">
            Restoring your session…
          </div>
        ) : session === "signed-out" ? (
          <form className="card auth-card stack" onSubmit={signIn} noValidate>
            <span className="eyebrow">YOUR MEDICINES, TOGETHER</span>
            <h1>{register ? "Create your account" : "Welcome back"}</h1>
            <p className="muted">
              Keep your medicines and treatment records together.
            </p>
            {register && (
              <div className="name-fields">
                <label>
                  First name
                  <input
                    required
                    aria-label="First name"
                    aria-invalid={!!fieldErrors.firstName}
                    aria-describedby={
                      fieldErrors.firstName ? "first-name-error" : undefined
                    }
                    autoComplete="given-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={busy}
                  />
                  {fieldErrors.firstName && (
                    <span
                      className="field-error"
                      id="first-name-error"
                      role="alert"
                    >
                      {fieldErrors.firstName}
                    </span>
                  )}
                </label>
                <label>
                  Last name
                  <input
                    required
                    aria-label="Last name"
                    aria-invalid={!!fieldErrors.lastName}
                    aria-describedby={
                      fieldErrors.lastName ? "last-name-error" : undefined
                    }
                    autoComplete="family-name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={busy}
                  />
                  {fieldErrors.lastName && (
                    <span
                      className="field-error"
                      id="last-name-error"
                      role="alert"
                    >
                      {fieldErrors.lastName}
                    </span>
                  )}
                </label>
              </div>
            )}
            <label>
              Email or international phone number
              <input
                required
                aria-label="Email or international phone number"
                aria-invalid={!!fieldErrors.identifier}
                aria-describedby={
                  fieldErrors.identifier ? "identifier-error" : undefined
                }
                autoCapitalize="none"
                autoComplete="username"
                placeholder="you@example.com or +213…"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={busy}
              />
              {fieldErrors.identifier && (
                <span
                  className="field-error"
                  id="identifier-error"
                  role="alert"
                >
                  {fieldErrors.identifier}
                </span>
              )}
            </label>
            <label>
              {register ? "Password (15–128 characters)" : "Password"}
              <input
                required
                type="password"
                aria-label={
                  register ? "Password (15–128 characters)" : "Password"
                }
                aria-invalid={!!fieldErrors.password}
                aria-describedby={
                  fieldErrors.password ? "password-error" : undefined
                }
                autoComplete={register ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
              />
              {fieldErrors.password && (
                <span className="field-error" id="password-error" role="alert">
                  {fieldErrors.password}
                </span>
              )}
            </label>
            {register && (
              <p className="muted small">
                Use 15–128 characters for your password. Spaces count and are
                kept exactly as entered. Your account uses English and your
                browser’s timezone. Notification choices are set separately.
              </p>
            )}
            <button disabled={busy}>
              {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setError("");
                setFieldErrors({});
              }}
            >
              {register ? "I already have an account" : "Create an account"}
            </button>
          </form>
        ) : (
          <>
            <div className="page-heading">
              <div>
                <span className="eyebrow">YOUR PERSONAL MEDICINE SPACE</span>
                <h1>
                  {listVisible
                    ? area
                    : view.kind === "treatment"
                      ? "Treatment details"
                      : "Medicine details"}
                </h1>
              </div>
              <button
                className="secondary"
                disabled={busy || loading || (area === "Settings" && dirty)}
                onClick={() => setRevision((n) => n + 1)}
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            {!listVisible && (
              <button
                className="back quiet"
                disabled={busy}
                onClick={() =>
                  navigate(
                    view.kind === "medicine" && view.treatmentId
                      ? { kind: "treatment", id: view.treatmentId }
                      : { kind: "list" },
                  )
                }
              >
                ←{" "}
                {view.kind === "medicine" && view.treatmentId
                  ? "Back to treatment"
                  : "Back to list"}
              </button>
            )}
            {loading && (
              <p role="status" className="muted">
                Loading…
              </p>
            )}
            {view.kind === "medicine" && medicine && (
              <div className="medicine-detail-layout">
                <MedicineCard medicine={medicine} />
                <div className="medicine-stock-column stack">
                  <AddStock
                    key={medicine.id}
                    medicineId={medicine.id}
                    busy={busy}
                    disabled={stockUncertain}
                    save={(body) =>
                      void action(async (valid) => {
                        try {
                          await backend(
                            "/api/backend/me/inventory",
                            "POST",
                            body,
                          );
                          if (valid()) {
                            navigate({ kind: "list" }, "My Pharmacy");
                            setStockFilter("All");
                            setPage(1);
                            setSuccess("Medicine added to My Pharmacy.");
                          }
                        } catch (e) {
                          if (valid()) {
                            setStockUncertain(true);
                            setError(
                              `${message(e)} The result may be uncertain. Check My Pharmacy before adding this entry again.`,
                            );
                          }
                          if (e instanceof RequestError && e.status === 401)
                            throw e;
                        }
                      })
                    }
                  />
                  {stockUncertain && (
                    <button
                      className="secondary"
                      onClick={() => switchArea("My Pharmacy")}
                    >
                      Check My Pharmacy
                    </button>
                  )}
                </div>
              </div>
            )}
            {view.kind === "treatment" && treatment && (
              <div className="stack">
                <div className="card treatment-summary">
                  <span className="badge">{treatment.status}</span>
                  <h2>{treatment.name}</h2>
                  <p className="muted">
                    {treatment.startDate} — {treatment.endDate}
                  </p>
                </div>
                {treatment.medications.length === 0 && (
                  <Empty title="No medications in this treatment" />
                )}
                {treatment.medications.map((m) => (
                  <section className="card stack" key={m.id}>
                    <div className="row">
                      <h2>
                        {m.dose} {m.doseUnit}
                      </h2>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          navigate({
                            kind: "medicine",
                            id: m.medicineId,
                            treatmentId: treatment.id,
                          })
                        }
                      >
                        View medicine
                      </button>
                    </div>
                    <p>
                      {m.instructions ?? "No additional instructions supplied."}
                    </p>
                    {m.schedules.length === 0 && (
                      <p className="muted">No schedules supplied.</p>
                    )}
                    {m.schedules.map((schedule, index) => (
                      <div className="stack" key={schedule.id}>
                        <h3>Schedule {index + 1}</h3>
                        {schedule.occurrences.length === 0 && (
                          <p className="muted">No occurrences available.</p>
                        )}
                        {schedule.occurrences.map((o) => (
                          <div className="occurrence" key={o.occurrenceId}>
                            <div>
                              <h3>{when(o.scheduledAt, o.timezone)}</h3>
                              <p className="muted">
                                {o.timezone} · Stored treatment timezone
                              </p>
                              <span className="status-label">
                                {o.event?.status ?? "Not recorded"}
                              </span>
                            </div>
                            {o.eligible && !o.event ? (
                              <div className="actions">
                                <button
                                  disabled={busy || loading || recordUncertain}
                                  onClick={() =>
                                    setConfirmation({
                                      occurrence: o,
                                      status: "TAKEN",
                                    })
                                  }
                                >
                                  Taken
                                </button>
                                <button
                                  className="secondary"
                                  disabled={busy || loading || recordUncertain}
                                  onClick={() =>
                                    setConfirmation({
                                      occurrence: o,
                                      status: "SKIPPED",
                                    })
                                  }
                                >
                                  Skipped
                                </button>
                              </div>
                            ) : !o.event ? (
                              <p className="muted small">
                                Not eligible for recording.
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            )}
            {listVisible && (area === "Home" || area === "My Pharmacy") && (
              <div className="stack">
                {area === "Home" && home && (
                  <HomeOverview
                    disabled={busy || loading}
                    data={home}
                    go={(next, low) => {
                      switchArea(next);
                      if (next === "My Pharmacy")
                        setStockFilter(low ? "Low stock" : "All");
                    }}
                    openTreatment={(id) => navigate({ kind: "treatment", id })}
                  />
                )}
                {area === "My Pharmacy" && (
                  <>
                    <p className="muted">
                      Your medicines, quantities and expiry dates in one place.
                    </p>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => switchArea("Medicines")}
                    >
                      Add a medicine
                    </button>
                    <div className="filter-row" aria-label="Pharmacy filters">
                      {(["All", "Low stock", "Expired"] as StockFilter[]).map(
                        (filter) => (
                          <button
                            className="secondary"
                            aria-pressed={stockFilter === filter}
                            key={filter}
                            disabled={busy || loading}
                            onClick={() => {
                              if (stockFilter === filter && page === 1) return;
                              generation.current++;
                              setStockFilter(filter);
                              setStock([]);
                              setPage(1);
                            }}
                          >
                            {filter}
                          </button>
                        ),
                      )}
                    </div>
                    {!loading && !error && (
                      <p className="muted">{stockTotal} stock entries</p>
                    )}
                  </>
                )}
                {!loading && !error && (
                  <>
                    <StockCards items={stock} />
                    {!stock.length && (
                      <Empty
                        title={
                          stockFilter === "All" || area === "Home"
                            ? "Your pharmacy starts here"
                            : "No matching medicines"
                        }
                      >
                        {stockFilter === "All" || area === "Home"
                          ? "Add your first medicine to keep track of what you have at home."
                          : "Try another filter to see your stock."}
                      </Empty>
                    )}
                  </>
                )}
              </div>
            )}
            {listVisible && area === "Prescriptions" && (
              <Prescriptions
                api={prescriptionApi}
                report={report}
                revision={revision}
              />
            )}
            {listVisible && isDirectoryArea(area) && (
              <HealthcareDirectory
                version={visibleSessionVersion ?? ""}
                key={`${visibleSessionVersion}:${area}`}
                area={area}
                api={prescriptionApi}
                report={report}
                revision={revision}
                navigate={switchArea}
              />
            )}
            {listVisible && area === "More" && (
              <div className="card-grid">
                {(
                  [
                    {
                      area: "Prescriptions",
                      title: "My Prescriptions",
                      text: "Create drafts, attach images and review prescriptions",
                    },
                    {
                      area: "Medicines",
                      title: "Medicine catalog",
                      text: "Search medicines and add stock",
                    },
                    {
                      area: "Hospitals",
                      title: "Hospitals",
                      text: "Find hospitals and healthcare facilities",
                    },
                    {
                      area: "Pharmacies",
                      title: "Pharmacies",
                      text: "Find pharmacy addresses and contact details",
                    },
                    {
                      area: "Doctors",
                      title: "Doctors",
                      text: "Search doctors by name, specialty and city",
                    },
                    {
                      area: "Inbox",
                      title: "Inbox",
                      text: "Review your in-app reminders",
                    },
                    {
                      area: "Settings",
                      title: "Settings",
                      text: "Choose your reminder preferences",
                    },
                  ] as const
                ).map((item) => (
                  <button
                    className="card list-card"
                    aria-label={item.area}
                    key={item.area}
                    onClick={() => switchArea(item.area)}
                  >
                    <h2>{item.title}</h2>
                    <p className="muted">{item.text}</p>
                  </button>
                ))}
              </div>
            )}
            {listVisible && area === "Treatments" && (
              <>
                <p className="intro muted">
                  Review your saved schedules and record doses.
                </p>
                <div className="card-grid">
                  {treatments.map((t) => (
                    <button
                      aria-label={`Open ${t.name}`}
                      className="card list-card"
                      key={t.id}
                      disabled={busy || loading}
                      onClick={() => navigate({ kind: "treatment", id: t.id })}
                    >
                      <span className="badge">{t.status}</span>
                      <h2>{t.name}</h2>
                      <p className="muted">
                        {t.startDate} — {t.endDate}
                      </p>
                      <span className="card-link">Review treatment →</span>
                    </button>
                  ))}
                </div>
                {!loading && !error && !treatments.length && (
                  <Empty title="No treatments yet">
                    Your saved treatments will appear here. Creating a treatment
                    in the portal is a future feature.
                  </Empty>
                )}
              </>
            )}
            {listVisible && area === "Medicines" && (
              <>
                <form
                  className="search-form catalog-search-bar"
                  onSubmit={(e) => {
                    e.preventDefault();
                    generation.current++;
                    setTerm(search.trim());
                    setPage(1);
                    setRevision((n) => n + 1);
                  }}
                >
                  <CategoryFilter
                    api={prescriptionApi}
                    value={category}
                    onChange={(value) => {
                      setCategory(value);
                      setPage(1);
                    }}
                  />
                  <MedicineSearch
                    label="Search medicine names"
                    value={search}
                    onChange={(value) => {
                      setSearch(value);
                      if (value.trim() === "*") {
                        generation.current++;
                        setTerm("*");
                        setPage(1);
                        setRevision((n) => n + 1);
                      }
                    }}
                    api={prescriptionApi}
                    category={category}
                    filters={directoryParams(directoryFilters, true)}
                    suggestionsEnabled={
                      directoryFilters.registrationStatus === "ACTIVE"
                    }
                    disabled={busy}
                    onSelect={(m) => navigate({ kind: "medicine", id: m.id })}
                  />
                  <button disabled={busy}>Search</button>
                </form>
                <DirectoryFilterFields
                  api={prescriptionApi}
                  value={directoryFilters}
                  onChange={(value) => {
                    setDirectoryFilters(value);
                    setPage(1);
                  }}
                >
                  <div className="result-view-controls">
                    <div
                      className="result-view-toggle"
                      role="group"
                      aria-label="Results view"
                    >
                      <button
                        type="button"
                        aria-pressed={resultView === "grid"}
                        onClick={() => setResultView("grid")}
                      >
                        <span aria-hidden="true">▦</span> Grid
                      </button>
                      <button
                        type="button"
                        aria-pressed={resultView === "list"}
                        onClick={() => setResultView("list")}
                      >
                        <span aria-hidden="true">☷</span> List
                      </button>
                    </div>
                    <label className="result-columns">
                      Columns
                      <select
                        aria-label="Result columns"
                        value={
                          resultView === "grid" ? gridColumns : listColumns
                        }
                        onChange={(event) => {
                          const count = Number(event.target.value);
                          if (resultView === "grid") setGridColumns(count);
                          else setListColumns(count);
                        }}
                      >
                        {(resultView === "grid" ? [2, 3, 4] : [1, 2]).map(
                          (count) => (
                            <option key={count} value={count}>
                              {count}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>
                </DirectoryFilterFields>
                <p className="intro muted">
                  Search by name, ingredient, laboratory, category, barcode,
                  MIPH code, strength or packaging.
                </p>
                <div
                  className="card-grid medicine-results"
                  data-view={resultView}
                  data-columns={
                    resultView === "grid" ? gridColumns : listColumns
                  }
                >
                  {medicines.map((m) => (
                    <button
                      aria-label={`Open ${m.name}`}
                      className="card list-card"
                      key={m.id}
                      disabled={busy || loading}
                      onClick={() => navigate({ kind: "medicine", id: m.id })}
                    >
                      <MedicineImage medicine={m} />
                      <div className="medicine-result-content">
                        <span className="medicine-category">
                          {m.category?.name ?? "Uncategorized"}
                        </span>
                        <p className="muted">{m.registrationHolder}</p>
                        <span className="badge">
                          {m.regulatoryStatus ?? m.status}
                        </span>
                        <Demo medicine={m} />
                        <h2>{m.name}</h2>
                        <p className="muted">
                          {[m.genericName, m.strength, m.dosageForm]
                            .filter(Boolean)
                            .join(" · ") || "Details not supplied"}
                        </p>
                        <span className="card-link">View medicine →</span>
                      </div>
                    </button>
                  ))}
                </div>
                {!loading && !error && !medicines.length && (
                  <Empty title="No medicines found">
                    Try another medicine name.
                  </Empty>
                )}
              </>
            )}
            {listVisible && area === "Inbox" && (
              <>
                <div className="row intro">
                  <p className="muted">
                    Your in-app reminders. Browser and phone push are not
                    connected.
                  </p>
                  {notices.length > 0 && (
                    <button
                      className="secondary"
                      disabled={busy || loading}
                      onClick={() =>
                        void action(async (valid) => {
                          await backend(
                            "/api/backend/me/notifications/read-all",
                            "PATCH",
                            {},
                          );
                          if (valid()) {
                            setSuccess("All reminders marked as read.");
                            setRevision((n) => n + 1);
                          }
                        })
                      }
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="stack">
                  {notices.map((n) => (
                    <article
                      className={`card notice ${n.readAt ? "" : "unread"}`}
                      key={n.id}
                    >
                      <div className="row">
                        <h2>{n.title}</h2>
                        {!n.readAt && <span className="badge">Unread</span>}
                      </div>
                      <p>{n.body}</p>
                      <p className="muted small">{when(n.createdAt)}</p>
                      <button
                        className="secondary"
                        disabled={busy || loading}
                        onClick={() =>
                          void action(async (valid) => {
                            await backend(
                              `/api/backend/me/notifications/${encodeURIComponent(n.id)}/read`,
                              "PATCH",
                              {},
                            );
                            if (valid())
                              navigate({
                                kind: "treatment",
                                id: n.data.treatmentId,
                              });
                          })
                        }
                      >
                        Review treatment
                      </button>
                    </article>
                  ))}
                </div>
                {!loading && !error && !notices.length && (
                  <Empty title="You’re all caught up">
                    Your reminders will appear here.
                  </Empty>
                )}
              </>
            )}
            {listVisible && area === "Settings" && (
              <div className="settings-grid">
                <section className="card stack">
                  <h2>Reminder preferences</h2>
                  <p className="muted">
                    {!preferencesLoaded
                      ? "Loading your saved choices…"
                      : configured
                        ? "Your saved choices"
                        : "Not configured. Choose and save your preferences. Nothing is enabled automatically."}
                  </p>
                  {(Object.keys(labels) as (keyof Flags)[]).map((key) => (
                    <label className="switch-row" key={key}>
                      <span>{labels[key]}</span>
                      <input
                        type="checkbox"
                        role="switch"
                        checked={flags[key]}
                        disabled={busy || loading || !preferencesLoaded}
                        onChange={(e) => {
                          dirtyRef.current = true;
                          setDirty(true);
                          setFlags((current) => ({
                            ...current,
                            [key]: e.target.checked,
                          }));
                          setSuccess("");
                        }}
                      />
                    </label>
                  ))}
                  <p className="muted small">
                    Only dose inbox reminders are delivered currently. Other
                    choices are saved for future features.
                  </p>
                  {dirty && (
                    <p className="muted small">
                      You have unsaved changes. Refresh will resume after
                      saving.
                    </p>
                  )}
                  <button
                    disabled={busy || loading || !preferencesLoaded}
                    onClick={() =>
                      void action(async (valid) => {
                        await backend(
                          "/api/backend/me/notification-preferences",
                          "PATCH",
                          flags,
                        );
                        if (valid()) {
                          dirtyRef.current = false;
                          setDirty(false);
                          setConfigured(true);
                          setSuccess("Preferences saved.");
                        }
                      })
                    }
                  >
                    {busy ? "Saving…" : "Save preferences"}
                  </button>
                </section>
                <section className="card stack settings-note">
                  <h2>Your account</h2>
                  <p className="muted">Sign out when using a shared browser.</p>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={logout}
                  >
                    Sign out
                  </button>
                </section>
              </div>
            )}
            {listVisible &&
              area !== "Settings" &&
              area !== "Home" &&
              area !== "More" &&
              area !== "Prescriptions" &&
              !isDirectoryArea(area) &&
              pages > 1 && (
                <nav className="pagination" aria-label="Pagination">
                  <button
                    className="secondary"
                    disabled={busy || loading || page <= 1}
                    onClick={() => {
                      generation.current++;
                      setPage((n) => n - 1);
                    }}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} of {pages}
                  </span>
                  <button
                    className="secondary"
                    disabled={busy || loading || page >= pages}
                    onClick={() => {
                      generation.current++;
                      setPage((n) => n + 1);
                    }}
                  >
                    Next
                  </button>
                </nav>
              )}
          </>
        )}
      </main>
      {session === "signed-in" && (
        <nav className="bottom-navigation" aria-label="Mobile navigation">
          {(["Home", "My Pharmacy", "Add", "Treatments", "More"] as const).map(
            (item) => (
              <button
                key={item}
                className={item === "Add" ? "add-action" : ""}
                aria-label={item === "Add" ? "Open quick actions" : item}
                aria-current={area === item ? "page" : undefined}
                disabled={busy}
                onClick={() =>
                  item === "Add" ? setQuickOpen(true) : switchArea(item)
                }
              >
                {item === "Add" ? (
                  <>
                    <span aria-hidden="true">＋</span>
                    <small>Add</small>
                  </>
                ) : item === "My Pharmacy" ? (
                  "Pharmacy"
                ) : (
                  item
                )}
              </button>
            ),
          )}
        </nav>
      )}
      <footer>Saydaliyati · All my medicines, in one place.</footer>
      <dialog
        ref={quickDialog}
        onCancel={() => setQuickOpen(false)}
        aria-labelledby="quick-title"
      >
        <div className="stack">
          <div className="row">
            <h2 id="quick-title">Quick actions</h2>
            <button
              className="quiet"
              autoFocus
              onClick={() => setQuickOpen(false)}
            >
              Close
            </button>
          </div>
          <button className="secondary" onClick={() => switchArea("Medicines")}>
            Add a medicine
          </button>
          <p className="muted">Search the catalog and record your stock.</p>
          <button
            className="secondary"
            onClick={() => switchArea("Prescriptions")}
          >
            My Prescriptions
          </button>
          <button
            className="secondary"
            onClick={() => switchArea("My Pharmacy")}
          >
            View My Pharmacy
          </button>
          <button
            className="secondary"
            onClick={() => switchArea("Treatments")}
          >
            Review treatments
          </button>
        </div>
      </dialog>
      <dialog
        ref={dialog}
        onCancel={() => setConfirmation(null)}
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-description"
      >
        <div className="stack">
          <h2 id="confirmation-title">
            Record this dose as{" "}
            {confirmation?.status === "TAKEN" ? "taken" : "skipped"}?
          </h2>
          <p id="confirmation-description">
            This record cannot be edited. It does not change your prescribed
            schedule.
          </p>
          {confirmation && (
            <p className="muted">
              {when(
                confirmation.occurrence.scheduledAt,
                confirmation.occurrence.timezone,
              )}{" "}
              · {confirmation.occurrence.timezone}
            </p>
          )}
          <div className="actions">
            <button
              className="secondary"
              autoFocus
              onClick={() => setConfirmation(null)}
            >
              Cancel
            </button>
            <button disabled={busy} onClick={confirmRecord}>
              Confirm
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
