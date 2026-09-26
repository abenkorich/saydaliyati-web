"use client";

export function DailyTimePicker({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange(value: string): void;
}) {
  const times = value.split(",").map((time) => time.trim());
  return (
    <fieldset
      className="stack"
      disabled={disabled}
      style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
    >
      <legend>Daily times</legend>
      {times.map((time, index) => (
        <div className="row" key={index}>
          <label style={{ flex: 1, minWidth: 0 }}>
            Daily time {index + 1}
            <input
              type="time"
              step={60}
              value={time}
              onChange={(event) =>
                onChange(
                  times
                    .map((old, i) => (i === index ? event.target.value : old))
                    .join(","),
                )
              }
            />
          </label>
          <button
            type="button"
            className="secondary"
            aria-label={`Remove daily time ${index + 1}`}
            onClick={() =>
              onChange(times.filter((_, i) => i !== index).join(","))
            }
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="secondary"
        disabled={disabled || times.length >= 24 || times.some((time) => !time)}
        onClick={() => onChange([...times, ""].join(","))}
      >
        Add time
      </button>
      <p className="muted">
        Choose each daily dose time. Leave blank if unknown.
      </p>
    </fieldset>
  );
}
