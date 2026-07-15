export default function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={
        "relative h-5 w-10 shrink-0 rounded-full transition-colors duration-200 " +
        (checked ? "bg-pale-blue" : "bg-hairline")
      }
    >
      <span
        className={
          "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-ink transition-transform duration-200 ease-in-out " +
          (checked ? "translate-x-5" : "translate-x-0")
        }
      />
    </button>
  );
}
