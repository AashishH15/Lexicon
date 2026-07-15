export default function ReviewPanel({ selectedText, activeTool, onClear }) {
  return (
    <div className="flex flex-col h-full">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted mb-3">
        Review Panel
      </p>
      {activeTool ? (
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] uppercase tracking-[0.08em] text-muted">
              {activeTool}
            </p>
            <button
              type="button"
              onClick={onClear}
              className="text-[10px] uppercase tracking-[0.08em] text-muted hover:text-ink"
            >
              Clear
            </button>
          </div>
          {selectedText ? (
            <p className="text-sm text-ink">{selectedText}</p>
          ) : (
            <p className="text-sm text-muted">No text selected in the document.</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">No output yet. Run a tool to see results.</p>
      )}
    </div>
  );
}
