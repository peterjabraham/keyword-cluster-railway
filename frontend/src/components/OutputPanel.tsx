import { OutputStatus } from "../stores/projectStore";

const statusDot: Record<OutputStatus["status"], string> = {
  waiting: "bg-slate-500",
  processing: "bg-amber-400",
  ready: "bg-emerald-400",
  error: "bg-rose-400"
};

export function OutputPanel({ outputs }: { outputs: OutputStatus[] }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-200">Outputs</h2>
        <button className="rounded bg-slate-800 px-3 py-1 text-xs uppercase tracking-widest text-slate-200">
          Export
        </button>
      </div>
      <div className="space-y-3">
        {outputs.map((output) => (
          <div
            key={output.id}
            className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`h-2 w-2 rounded-full ${statusDot[output.status]}`}
                />
                <span className="text-sm font-semibold text-slate-100">
                  {output.title}
                </span>
              </div>
              <span className="text-xs uppercase text-slate-400">
                {output.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">{output.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
