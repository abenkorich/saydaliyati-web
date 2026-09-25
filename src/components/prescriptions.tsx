"use client";
import { MedicineSearch } from "./medicine-search";
import { useEffect, useRef, useState } from "react";
import {
  blank,
  fields,
  inputValues,
  createBody,
  reviewBody,
  confirmationBody,
  confirmationProblem,
  nextPage,
  uploadError,
  type Inputs,
  type Medication,
  type Request,
} from "./prescription-model";
import { usePrescriptions } from "./use-prescriptions";
function MedicinePicker({
  value,
  disabled,
  onChange,
  api,
}: {
  value: string;
  disabled: boolean;
  onChange(id: string): void;
  api: Request;
}) {
  const [query,setQuery]=useState("");
  return <div><p>{value ? "Catalog medicine linked. Search to replace it." : "Choose a medicine or keep the written name."}</p>
    <MedicineSearch value={query} onChange={setQuery} api={api} disabled={disabled} label="Search catalog" onSelect={m=>onChange(m.id)}/>
    {!!value && <button type="button" disabled={disabled} onClick={()=>onChange("")}>Clear catalog link</button>}
  </div>;
}

function Editor({
  value,
  onChange,
  api,
  disabled,
}: {
  value: Inputs;
  onChange(value: Inputs): void;
  api: Request;
  disabled: boolean;
}) {
  return (
    <div className="stack">
      {fields.map((f) => (
        <div className="stack" key={f.name}>
          {f.kind === "medicine" ? (
            <>
              <strong>{f.label}</strong>
              <MedicinePicker
                api={api}
                value={value.medicineId}
                disabled={disabled}
                onChange={(id) => onChange({ ...value, medicineId: id })}
              />
            </>
          ) : (
            <label>
              {f.label}
              {f.name === "instructions" ? (
                <textarea
                  rows={3}
                  value={value[f.name]}
                  disabled={disabled}
                  onChange={(e) =>
                    onChange({ ...value, [f.name]: e.target.value })
                  }
                />
              ) : (
                <input
                  value={value[f.name]}
                  disabled={disabled}
                  inputMode={f.kind === "number" ? "decimal" : undefined}
                  placeholder={
                    f.kind === "date"
                      ? "YYYY-MM-DD"
                      : f.kind === "times"
                        ? "08:00, 20:00"
                        : "Unknown if blank"
                  }
                  onChange={(e) =>
                    onChange({ ...value, [f.name]: e.target.value })
                  }
                />
              )}
            </label>
          )}
        </div>
      ))}
    </div>
  );
}
function LineReview({
  line,
  editable,
  api,
  busy,
  save,
  reject,
  onDirty,
}: {
  line: Medication;
  editable: boolean;
  api: Request;
  busy: boolean;
  save(body: unknown): void;
  reject(): void;
  onDirty(): void;
}) {
  const [value, setValue] = useState(() => inputValues(line));
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(line.fields.map((f) => [f.fieldName, f.confirmed])),
  );
  const [error, setError] = useState("");
  if (!editable)
    return (
      <section className="card stack">
        <h3>{line.medicine?.name ?? line.extractedName ?? "Medicine"}</h3>
        <span className="badge">{line.confirmationStatus}</span>
        <dl className="facts">
          {fields.map((f) => (
            <div key={f.name}>
              <dt>{f.label}</dt>
              <dd>
                {f.name === "medicineId"
                  ? (line.medicine?.name ?? "Unknown")
                  : value[f.name] || "Unknown"}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    );
  return (
    <section className="card stack">
      <h3>{line.medicine?.name ?? line.extractedName ?? "Medicine"}</h3>
      <p className="muted">
        Blank means unknown. Editing a field clears its review check. Save your
        review for each medicine.
      </p>
      <Editor
        value={value}
        onChange={(next) => {
          onDirty();
          setChecked((previous) => ({
            ...previous,
            ...Object.fromEntries(
              fields
                .filter((f) => value[f.name] !== next[f.name])
                .map((f) => [f.name, false]),
            ),
          }));
          setValue(next);
        }}
        api={api}
        disabled={busy}
      />
      <fieldset className="stack">
        <legend>Review every value, including unknowns</legend>
        {fields.map((f) => (
          <label key={f.name} className="row">
            <input
              type="checkbox"
              checked={!!checked[f.name]}
              disabled={busy}
              onChange={(e) => {
                onDirty();
                setChecked({ ...checked, [f.name]: e.target.checked });
              }}
            />
            <span>
              I reviewed {f.label.toLowerCase()}:{" "}
              {f.name === "medicineId"
                ? value.medicineId
                  ? "linked catalog medicine"
                  : "unknown"
                : value[f.name] || "unknown"}
            </span>
          </label>
        ))}
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <button
        disabled={busy}
        onClick={() => {
          try {
            const body = reviewBody(line, value, checked);
            setError("");
            save(body);
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Save this medicine review
      </button>
      <button className="quiet" disabled={busy} onClick={reject}>
        Reject this medicine line
      </button>
    </section>
  );
}
export function Prescriptions({
  api,
  report,
  revision,
}: {
  api: Request;
  report(e: unknown): void;
  revision: number;
}) {
  const r = usePrescriptions(api, report, revision);
  const [lines, setLines] = useState<Inputs[]>([blank()]);
  const [date, setDate] = useState(""),
    [until, setUntil] = useState("");
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    body: unknown;
    method?: string;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const section = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (confirm) dialog.current?.showModal();
    else dialog.current?.close();
  }, [confirm]);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const rx = r.detail;
  const hasEdits = !!rx?.medications.some(
    (line) => dirty[line.fields.map((f) => f.id).join(":")],
  );
  const viewKey = r.creating ? "new" : (rx?.id ?? "list");
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [viewKey]);
  const editable = rx?.status === "DRAFT" && !r.blocked;
  return (
    <div
      ref={section}
      tabIndex={-1}
      className="stack rx-section"
      aria-busy={r.busy}
    >
      {r.error && (
        <div className="error" role="alert">
          {r.error}
        </div>
      )}
      {r.notice && <p role="status">{r.notice}</p>}
      {(rx || r.creating) && (
        <button
          className="secondary"
          disabled={r.busy}
          onClick={() => {
            if (
              !r.creating ||
              window.confirm("Leave this draft? Unsaved entries will be lost.")
            )
              r.list();
          }}
        >
          Back to prescriptions
        </button>
      )}
      {!rx && !r.creating && (
        <>
          <p className="muted">
            Save prescription details, attach original images, and review what
            you entered.
          </p>
          <button
            disabled={r.busy}
            onClick={() => {
              setLines([blank()]);
              setDate("");
              setUntil("");
              r.setError("");
              r.setCreating(true);
            }}
          >
            New prescription
          </button>
          <label>
            Prescription status
            <select
              value={r.filter}
              disabled={r.busy}
              onChange={(e) => {
                r.setPage(1);
                r.setFilter(e.target.value);
              }}
            >
              <option value="">Current prescriptions</option>
              {["DRAFT", "CONFIRMED", "ARCHIVED"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {r.rows.map((row) => (
            <button
              key={row.id}
              className="card list-card"
              disabled={r.busy}
              onClick={() => void r.open(row.id)}
            >
              <strong>
                Prescription ·{" "}
                {row.prescriptionDate ?? row.createdAt.slice(0, 10)}
              </strong>
              <span>
                {row.status} · {row.medicationCount} medicine lines
              </span>
            </button>
          ))}
          {r.loading && <p role="status">Loading prescriptions…</p>}
          {!r.loading && !r.rows.length && !r.error && (
            <p>No prescriptions yet. Create a manual draft to get started.</p>
          )}
          <div className="row">
            <button
              className="secondary"
              disabled={r.page <= 1 || r.busy}
              onClick={() => r.setPage(r.page - 1)}
            >
              Previous prescriptions
            </button>
            <span>
              Page {r.page} of {Math.max(1, r.pages)}
            </span>
            <button
              className="secondary"
              disabled={r.page >= r.pages || r.busy}
              onClick={() => r.setPage(r.page + 1)}
            >
              Next prescriptions
            </button>
          </div>
        </>
      )}
      {r.creating && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              const body = createBody(lines, date, until);
              void r.create(body);
            } catch (e) {
              r.setError((e as Error).message);
            }
          }}
        >
          <h2>New prescription</h2>
          <p>
            Copy the prescription as written. Leave unknown values blank. You
            can attach an image after saving the draft; images are not read
            automatically.
          </p>
          <label>
            Prescription date (optional)
            <input
              placeholder="YYYY-MM-DD"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label>
            Valid until (optional)
            <input
              placeholder="YYYY-MM-DD"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
          </label>
          {lines.map((line, index) => (
            <section className="card stack" key={index}>
              <h3>Medicine {index + 1}</h3>
              <Editor
                value={line}
                onChange={(v) =>
                  setLines(lines.map((old, i) => (i === index ? v : old)))
                }
                api={api}
                disabled={r.busy || r.blocked}
              />
              {lines.length > 1 && (
                <button
                  type="button"
                  className="quiet"
                  disabled={r.busy || r.blocked}
                  onClick={() => setLines(lines.filter((_, i) => i !== index))}
                >
                  Remove medicine {index + 1}
                </button>
              )}
            </section>
          ))}
          <button
            type="button"
            className="secondary"
            disabled={r.busy || r.blocked || lines.length >= 20}
            onClick={() => setLines([...lines, blank()])}
          >
            Add another medicine
          </button>
          <button disabled={r.busy || r.blocked}>Save draft</button>
        </form>
      )}
      {rx && (
        <>
          <div className="card stack">
            <h2>
              Prescription · {rx.prescriptionDate ?? rx.createdAt.slice(0, 10)}
            </h2>
            <span className="badge">{rx.status}</span>
            <p>Valid until: {rx.validUntil ?? "Not recorded"}</p>
            <button
              className="secondary"
              disabled={r.busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Reload saved values? Unsaved field edits will be discarded.",
                  )
                )
                  void r.open(rx.id).then(() => setDirty({}));
              }}
            >
              Reload prescription
            </button>
          </div>
          <section className="card stack">
            <h3>Original images</h3>
            <p>
              JPEG or PNG, up to 5 MiB and 20 million pixels per page. No OCR is
              performed. Original files may include location metadata; remove it
              before selecting an image if unwanted.
            </p>
            {rx.documents.map((d) => (
              <button
                className="secondary"
                key={d.id}
                disabled={r.busy}
                onClick={() =>
                  void r.run(async () => {
                    const result = await api<{ url: string }>(
                      `/me/prescriptions/${rx.id}/documents/${d.id}/download`,
                    );
                    const url = new URL(result.data.url);
                    if (!["http:", "https:"].includes(url.protocol))
                      throw new Error("Invalid document link.");
                    window.location.assign(url.href);
                  })
                }
              >
                Download page {d.pageNumber}
              </button>
            ))}
            {!rx.documents.length && <p>No attached images.</p>}
            {editable && rx.documents.length < 20 && (
              <label>
                Attach page {nextPage(rx)}
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  disabled={r.busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    const problem = uploadError(file.type, file.size);
                    if (problem) {
                      r.setError(problem);
                      return;
                    }
                    const form = new FormData();
                    form.append("file", file);
                    form.append("pageNumber", String(nextPage(rx)));
                    void r.upload(form);
                  }}
                />
              </label>
            )}
          </section>
          {rx.medications.map((line) => (
            <LineReview
              key={`${line.id}:${line.fields.map((f) => f.id).join(":")}:${r.blocked}`}
              onDirty={() =>
                setDirty((previous) => ({
                  ...previous,
                  [line.fields.map((f) => f.id).join(":")]: true,
                }))
              }
              line={line}
              editable={!!editable && line.confirmationStatus !== "REJECTED"}
              api={api}
              busy={r.busy}
              save={(body) => void r.mutate(body)}
              reject={() =>
                setConfirm({
                  title: "Reject this medicine?",
                  description:
                    "The line remains in history and cannot be restored through this workflow.",
                  body: { rejectedMedicationIds: [line.id] },
                })
              }
            />
          ))}
          {editable && (
            <section className="card stack">
              <h3>Confirm reviewed prescription</h3>
              <p>
                This confirms your entered information. It is not professional
                verification and does not create or activate a treatment.
              </p>
              {hasEdits && (
                <p role="status">
                  Save your edited medicine reviews before confirming.
                </p>
              )}
              {confirmationProblem(rx) && (
                <p role="status">{confirmationProblem(rx)}</p>
              )}
              <button
                disabled={r.busy || hasEdits || !!confirmationProblem(rx)}
                onClick={() =>
                  setConfirm({
                    title: "Confirm this prescription?",
                    description:
                      "The saved review will be finalized and can no longer be edited. This will not start a treatment.",
                    body: confirmationBody(rx),
                  })
                }
              >
                Confirm prescription
              </button>
            </section>
          )}
          {rx.status !== "ARCHIVED" && (
            <button
              className="quiet"
              disabled={r.busy || r.blocked}
              onClick={() =>
                setConfirm({
                  title: "Archive prescription?",
                  description:
                    "It will move to Archived. Documents and history are preserved; restoring it is not available.",
                  body: {},
                  method: "DELETE",
                })
              }
            >
              Archive prescription
            </button>
          )}
        </>
      )}
      <dialog
        ref={dialog}
        onCancel={() => setConfirm(null)}
        aria-labelledby="rx-confirm-title"
      >
        <div className="stack">
          <h2 id="rx-confirm-title">{confirm?.title}</h2>
          <p>{confirm?.description}</p>
          <button className="secondary" onClick={() => setConfirm(null)}>
            Cancel
          </button>
          <button
            onClick={() => {
              if (confirm) {
                const pending = confirm;
                dialog.current?.close();
                setConfirm(null);
                void r
                  .mutate(pending.body, pending.method)
                  .then(() => section.current?.focus());
              }
            }}
          >
            Confirm action
          </button>
        </div>
      </dialog>
    </div>
  );
}
