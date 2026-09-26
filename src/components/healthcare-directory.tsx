"use client";
import { useEffect, useState } from "react";
import type { Request } from "./prescription-model";
export const directoryAreas = {
  Hospitals: "hospitals",
  Pharmacies: "pharmacies",
  Doctors: "doctors",
} as const;
export type DirectoryArea = keyof typeof directoryAreas;
export function isDirectoryArea(area: string): area is DirectoryArea {
  return Object.prototype.hasOwnProperty.call(directoryAreas, area);
}
type Entry = {
  id: string;
  name: string;
  specialty: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
};
export function HealthcareDirectory({
  area,
  api,
  report,
  revision,
  navigate,
}: {
  area: DirectoryArea;
  api: Request;
  report(error: unknown): void;
  revision: number;
  navigate(area: DirectoryArea): void;
}) {
  const [query, setQuery] = useState(""),
    [city, setCity] = useState("");
  const [filters, setFilters] = useState({ q: "", city: "" });
  const [page, setPage] = useState(1),
    [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    rows: Entry[];
    pages: number;
    total: number;
    loading: boolean;
    error: boolean;
  }>({ rows: [], pages: 1, total: 0, loading: true, error: false });
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.city ? { city: filters.city } : {}),
    });
    void Promise.resolve()
      .then(() => {
        if (active)
          setState({
            rows: [],
            pages: 1,
            total: 0,
            loading: true,
            error: false,
          });
        return api<Entry[]>(`/directory/${directoryAreas[area]}?${params}`);
      })
      .then((result) => {
        if (active)
          setState({
            rows: result.data,
            pages: Math.max(1, result.meta?.totalPages ?? 1),
            total: result.meta?.total ?? result.data.length,
            loading: false,
            error: false,
          });
      })
      .catch((error) => {
        if (!active) return;
        setState({ rows: [], pages: 1, total: 0, loading: false, error: true });
        if ((error as { status?: number })?.status === 401) report(error);
      });
    return () => {
      active = false;
    };
  }, [area, api, filters, page, retry, revision, report]);
  const reset = () => {
    setQuery("");
    setCity("");
    setFilters({ q: "", city: "" });
    setPage(1);
  };
  return (
    <section
      className="healthcare-directory stack"
      aria-label={`${area} directory`}
    >
      <nav className="care-directory-tabs" aria-label="Healthcare directories">
        {(Object.keys(directoryAreas) as DirectoryArea[]).map((name) => (
          <button
            key={name}
            className="secondary"
            aria-current={area === name ? "page" : undefined}
            onClick={() => navigate(name)}
          >
            {name}
          </button>
        ))}
      </nav>
      <p className="muted">
        Find {area.toLowerCase()} and their contact details. Contact the
        provider to confirm services and opening hours.
      </p>
      <form
        className="care-directory-search"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters({ q: query.trim(), city: city.trim() });
          setPage(1);
        }}
      >
        <label>
          Search {area.toLowerCase()}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={100}
            placeholder={
              area === "Doctors" ? "Name or specialty" : "Name or service"
            }
          />
        </label>
        <label>
          City
          <input
            value={city}
            onChange={(event) => setCity(event.target.value)}
            maxLength={100}
            placeholder="Enter a city"
          />
        </label>
        <button type="submit">Search directory</button>
        {(query || city || filters.q || filters.city) && (
          <button className="quiet" type="button" onClick={reset}>
            Clear filters
          </button>
        )}
      </form>
      {state.loading ? (
        <p role="status">Loading {area.toLowerCase()}…</p>
      ) : state.error ? (
        <div className="error stack" role="alert">
          <p>We couldn’t load the directory. Please try again.</p>
          <button
            className="secondary"
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry directory
          </button>
        </div>
      ) : (
        <>
          <p className="muted" role="status">
            {state.total} {state.total === 1 ? "result" : "results"}
          </p>
          {!state.rows.length && (
            <div className="card empty">
              <h2>No {area.toLowerCase()} found</h2>
              <p>
                {filters.q || filters.city
                  ? "Try a different name, specialty or city."
                  : "Directory entries will appear here when available."}
              </p>
            </div>
          )}
          <div className="card-grid">
            {state.rows.map((entry) => {
              const phone = entry.phone?.replace(/[\s().-]/g, "");
              const location = [entry.name, entry.address, entry.city]
                .filter(Boolean)
                .join(", ");
              return (
                <article
                  className="card stack care-directory-card"
                  key={entry.id}
                >
                  <span className="badge">
                    {area === "Doctors"
                      ? "Doctor"
                      : area === "Pharmacies"
                        ? "Pharmacy"
                        : "Hospital"}
                  </span>
                  <h2>{entry.name}</h2>
                  {entry.specialty && (
                    <p className="care-specialty">{entry.specialty}</p>
                  )}
                  <dl>
                    <div>
                      <dt>Address</dt>
                      <dd>{entry.address || "Address not provided"}</dd>
                    </div>
                    <div>
                      <dt>City</dt>
                      <dd>{entry.city || "City not provided"}</dd>
                    </div>
                  </dl>
                  <div className="care-directory-contacts">
                    {entry.phone &&
                      (phone && /^\+?\d{3,15}$/.test(phone) ? (
                        <a
                          href={`tel:${phone}`}
                          aria-label={`Call ${entry.name}`}
                        >
                          {entry.phone}
                        </a>
                      ) : (
                        <span>{entry.phone}</span>
                      ))}
                    {entry.email && (
                      <a
                        href={`mailto:${encodeURIComponent(entry.email)}`}
                        aria-label={`Email ${entry.name}`}
                      >
                        {entry.email}
                      </a>
                    )}
                    {!entry.phone && !entry.email && (
                      <span className="muted">
                        Contact details not provided
                      </span>
                    )}
                    {(entry.address || entry.city) && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View ${entry.name} on map`}
                      >
                        View on map ↗
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {state.pages > 1 && (
            <nav className="pagination" aria-label="Directory pagination">
              <button
                className="secondary"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </button>
              <span>
                Page {page} of {state.pages}
              </span>
              <button
                className="secondary"
                disabled={page >= state.pages}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
