import { StepState } from "../stores/projectStore";

const statusStyles: Record<StepState["status"], string> = {
  done: "border-emerald-500 text-emerald-200",
  current: "border-sky-500 text-sky-200",
  locked: "border-slate-700 text-slate-400"
};

export function StepWizard({ steps }: { steps: StepState[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-200">Setup Wizard</h2>
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`rounded-lg border px-4 py-3 ${statusStyles[step.status]}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm uppercase tracking-widest">
                Step {index + 1}
              </span>
              <span className="text-xs font-semibold uppercase">
                {step.status}
              </span>
            </div>
            <div className="mt-2 text-base font-medium">{step.title}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
