export function UserStateConfig() {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-4">
      <h3 className="text-sm font-semibold text-slate-200">
        User State Router
      </h3>
      <div className="mt-3 space-y-3">
        <textarea
          className="min-h-[60px] w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Jobs to be done (Choose, Buy, Use, Fix, Prove)"
        />
        <textarea
          className="min-h-[60px] w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Constraints (Risk, Time, Budget, Compatibility, Authority)"
        />
        <textarea
          className="min-h-[60px] w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Outcomes (Growth, Time saved, Risk reduced)"
        />
      </div>
    </div>
  );
}
