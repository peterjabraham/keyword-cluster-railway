interface AudienceConfigValues {
  buyer: string;
  champion: string;
  economicBuyer: string;
  verticals: string;
}

interface AudienceConfigProps {
  values: AudienceConfigValues;
  onChange: (values: AudienceConfigValues) => void;
}

export function AudienceConfig({ values, onChange }: AudienceConfigProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-4">
      <h3 className="text-sm font-semibold text-slate-200">
        Audience & Roles
      </h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Buyer"
          value={values.buyer}
          onChange={(event) =>
            onChange({ ...values, buyer: event.target.value })
          }
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Champion"
          value={values.champion}
          onChange={(event) =>
            onChange({ ...values, champion: event.target.value })
          }
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Economic buyer"
          value={values.economicBuyer}
          onChange={(event) =>
            onChange({ ...values, economicBuyer: event.target.value })
          }
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Verticals (comma-separated)"
          value={values.verticals}
          onChange={(event) =>
            onChange({ ...values, verticals: event.target.value })
          }
        />
      </div>
    </div>
  );
}
