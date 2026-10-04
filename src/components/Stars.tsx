export function Stars({ value, onChange }: { value: number | null; onChange?: (v: number | null) => void }) {
  return (
    <span className={`stars ${onChange ? "editable" : ""}`} aria-label={value ? `${value} out of 5` : "Not rated"}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button type="button" key={n} className={value !== null && n <= value ? "on" : ""} onClick={() => onChange(value === n ? null : n)} aria-label={`${n} stars`}>
            ★
          </button>
        ) : (
          <span key={n} className={value !== null && n <= value ? "on" : ""}>
            ★
          </span>
        ),
      )}
    </span>
  );
}
