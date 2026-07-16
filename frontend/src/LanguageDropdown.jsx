import { useEffect, useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

export default function LanguageDropdown({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = options.find((item) => item.code === value);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded border border-hairline bg-canvas px-4 py-2.5 font-sans text-sm text-ink transition-colors hover:border-muted"
      >
        <span>{selected ? selected.label : "Select language"}</span>
        <CaretDown
          size={14}
          weight="bold"
          className={"text-muted transition-transform duration-200 " + (open ? "rotate-180" : "")}
        />
      </button>

      {open && (
        <ul className="lex-pop absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-hairline bg-white">
          {options.map((item) => {
            const active = item.code === value;
            return (
              <li key={item.code}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(item.code);
                    setOpen(false);
                  }}
                  className={
                    "block w-full px-4 py-2 text-left font-sans text-sm transition-colors " +
                    (active
                      ? "bg-pale-blue text-pale-blue-text"
                      : "text-ink hover:bg-pale-blue hover:text-pale-blue-text")
                  }
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
