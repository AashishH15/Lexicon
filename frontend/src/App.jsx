import Toolbar from "./Toolbar.jsx";

export default function App() {
  return (
    <div className="flex flex-col h-screen bg-canvas text-ink">
      <header className="flex items-center px-6 h-14 border-b border-hairline">
        <div className="leading-tight">
          <span className="block font-serif text-lg tracking-tight">Lexicon</span>
          <span className="block font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
            System Toolset V3.0
          </span>
        </div>
      </header>

      <main className="flex flex-1 min-h-0">
        <aside className="w-64 shrink-0 border-r border-hairline p-4">
          <Toolbar />
        </aside>

        <section className="flex-1 min-w-0 border-r border-hairline p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
            Source Document
          </p>
        </section>

        <aside className="w-80 shrink-0 p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
            Review Panel
          </p>
        </aside>
      </main>
    </div>
  );
}
