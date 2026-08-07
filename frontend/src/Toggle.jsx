export default function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={
        "relative flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 " +
        (checked
          ? "bg-pale-blue-text"
          : "bg-neutral-200 border border-neutral-300 dark:bg-neutral-700 dark:border-neutral-600")
      }
    >
      <span
        className={
          "h-4 w-4 rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out " +
          (checked ? "translate-x-4" : "translate-x-0")
        }
      />
    </button>
  );
}
