export function AudienceConfig() {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-4">
      <h3 className="text-sm font-semibold text-slate-200">
        Audience & Roles
      </h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Buyer"
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Champion"
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Economic buyer"
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Verticals (comma-separated)"
        />
      </div>
    </div>
  );
}
