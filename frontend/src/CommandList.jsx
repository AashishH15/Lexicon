import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";

// Presentational list for the slash-command menu. It owns the keyboard
// navigation (up/down/enter, wrapping) and forwards the selected command back
// through the `command` prop. The parent (the Suggestion render callback)
// delegates its `onKeyDown` to this component's imperative `onKeyDown`.
const CommandList = forwardRef(function CommandList({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef(null);
  const itemRefs = useRef([]);

  // Reset the highlight whenever the filtered set changes so the first row is
  // always the default Enter target.
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  // Keep the highlighted row in view as the user arrows through a long list.
  useLayoutEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  function select(index) {
    const item = items[index];
    if (item) {
      command(item);
    }
  }

  function onKeyDown({ event }) {
    if (items.length === 0) {
      return false;
    }
    if (event.key === "ArrowUp") {
      setSelectedIndex((current) => (current + items.length - 1) % items.length);
      return true;
    }
    if (event.key === "ArrowDown") {
      setSelectedIndex((current) => (current + 1) % items.length);
      return true;
    }
    if (event.key === "Enter") {
      select(selectedIndex);
      return true;
    }
    return false;
  }

  useImperativeHandle(ref, () => ({
    onKeyDown,
  }));

  if (items.length === 0) {
    return (
      <div role="listbox" aria-label="No matching commands" className="lex-pop w-64 rounded-lg border border-hairline bg-white p-3 font-sans text-xs text-muted shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        No matching commands
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Slash commands"
      className="lex-pop scrollbar-none max-h-72 w-72 overflow-y-auto rounded-lg border border-hairline bg-white py-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
    >
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        const isActive = item.active;
        return (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={isSelected}
            ref={(el) => (itemRefs.current[index] = el)}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => select(index)}
            className={
              "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors focus-visible:ring-1 focus-visible:ring-ink " +
              (isSelected
                ? "bg-pale-blue text-pale-blue-text"
                : "text-ink hover:bg-hairline/60")
            }
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center">
              <item.icon size={16} weight="bold" />
            </span>
            <span className="flex-1 truncate">{item.label}</span>
            {item.hint && (
              <span className="lex-kbd shrink-0">{item.hint}</span>
            )}
            {isActive && (
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-pale-blue-text">
                Active
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});

export default CommandList;
