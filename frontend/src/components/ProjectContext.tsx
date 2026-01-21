interface ProjectContextValues {
  channel: string;
  motion: string;
  conversion: string;
  metric: string;
}

interface ProjectContextProps {
  values: ProjectContextValues;
  onChange: (values: ProjectContextValues) => void;
}

export function ProjectContext({ values, onChange }: ProjectContextProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-4">
      <h3 className="text-sm font-semibold text-slate-200">
        Project Context
      </h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Channel (e.g. SaaS)"
          value={values.channel}
          onChange={(event) =>
            onChange({ ...values, channel: event.target.value })
          }
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Motion (e.g. Enterprise)"
          value={values.motion}
          onChange={(event) =>
            onChange({ ...values, motion: event.target.value })
          }
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Primary conversion"
          value={values.conversion}
          onChange={(event) =>
            onChange({ ...values, conversion: event.target.value })
          }
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Success metric"
          value={values.metric}
          onChange={(event) =>
            onChange({ ...values, metric: event.target.value })
          }
        />
      </div>
    </div>
  );
}
