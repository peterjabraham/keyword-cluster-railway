export function ConstraintsConfig() {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-4">
      <h3 className="text-sm font-semibold text-slate-200">
        Constraints & Proof
      </h3>
      <div className="mt-3 space-y-3">
        <textarea
          className="min-h-[60px] w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Excluded terms"
        />
        <textarea
          className="min-h-[60px] w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Must-haves (SOC2, ISO, etc.)"
        />
        <textarea
          className="min-h-[60px] w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Proof assets (case studies, ROI calc, demo)"
        />
      </div>
    </div>
  );
}
