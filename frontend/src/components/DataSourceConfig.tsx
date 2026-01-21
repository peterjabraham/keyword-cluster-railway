interface DataSourceValues {
  gsc: string;
  ga4: string;
  ads: string;
  crm: string;
}

interface DataSourceConfigProps {
  values: DataSourceValues;
  onChange: (values: DataSourceValues) => void;
}

export function DataSourceConfig({ values, onChange }: DataSourceConfigProps) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-4">
      <h3 className="text-sm font-semibold text-slate-200">Data Sources</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="GSC Property ID"
          value={values.gsc}
          onChange={(event) =>
            onChange({ ...values, gsc: event.target.value })
          }
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="GA4 Property ID"
          value={values.ga4}
          onChange={(event) =>
            onChange({ ...values, ga4: event.target.value })
          }
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="Ads account"
          value={values.ads}
          onChange={(event) =>
            onChange({ ...values, ads: event.target.value })
          }
        />
        <input
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="CRM source"
          value={values.crm}
          onChange={(event) =>
            onChange({ ...values, crm: event.target.value })
          }
        />
      </div>
    </div>
  );
}
