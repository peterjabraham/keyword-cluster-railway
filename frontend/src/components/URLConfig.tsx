export function URLConfig() {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-4">
      <h3 className="text-sm font-semibold text-slate-200">URLs & Pages</h3>
      <div className="mt-3 space-y-3">
        <input
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Target domain"
        />
        <textarea
          className="min-h-[80px] w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Money pages (one per line)"
        />
        <textarea
          className="min-h-[80px] w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Competitor domains (one per line)"
        />
      </div>
    </div>
  );
}
