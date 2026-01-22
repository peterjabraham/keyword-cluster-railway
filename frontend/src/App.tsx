import { useMemo, useState } from "react";
import { useProjectStore } from "./stores/projectStore";

export default function App() {
  const projectId = useProjectStore((state) => state.projectId);
  const setProjectId = useProjectStore((state) => state.setProjectId);
  const inputs = useProjectStore((state) => state.stage1Inputs);
  const clusters = useProjectStore((state) => state.stage1Clusters);
  const keywords = useProjectStore((state) => state.stage1Keywords);
  const setStage1Inputs = useProjectStore((state) => state.setStage1Inputs);
  const setStage1Clusters = useProjectStore((state) => state.setStage1Clusters);
  const setStage1Keywords = useProjectStore((state) => state.setStage1Keywords);
  const toggleStage1Cluster = useProjectStore(
    (state) => state.toggleStage1Cluster
  );
  const setStage1ClusterSelection = useProjectStore(
    (state) => state.setStage1ClusterSelection
  );

  const [clusterLoading, setClusterLoading] = useState(false);
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataForSeoStatus, setDataForSeoStatus] = useState<{
    status: "ok" | "empty" | "error" | "queued";
    message?: string;
    statusCode?: number;
    itemsCount?: number;
  } | null>(null);
  const [dataForSeoTesting, setDataForSeoTesting] = useState(false);
  const [dataForSeoSanityLoading, setDataForSeoSanityLoading] = useState(false);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState<string | null>(null);
  const [diagnosticsData, setDiagnosticsData] = useState<{
    errors?: unknown;
    idList?: unknown;
  } | null>(null);

  const selectedIds = useMemo(
    () => clusters.filter((cluster) => cluster.selected).map((cluster) => cluster.id),
    [clusters]
  );

  const parseLines = (value: string) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  const parseNumberInput = (value: string, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const handleInputChange = (
    field: keyof typeof inputs,
    value: string | boolean | number
  ) => {
    setStage1Inputs({ ...inputs, [field]: value });
  };

  const handleGenerateClusters = async () => {
    if (!inputs.targetUrl) {
      setError("Please enter a target URL.");
      return;
    }

    setError(null);
    setClusterLoading(true);
    try {
      let activeProjectId = projectId;
      if (!activeProjectId) {
        const createResponse = await fetch("/api/stage1/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetUrl: inputs.targetUrl,
            competitors: parseLines(inputs.competitors),
            initialClusters: parseLines(inputs.initialClusters),
            industry: inputs.industry,
            audience: inputs.audience,
            constraints: parseLines(inputs.constraints),
            country: inputs.country,
            minVolumeEnabled: inputs.minVolumeEnabled,
            marketType: inputs.marketType,
            maxClusters: inputs.maxClusters,
            maxRowsPerCluster: inputs.maxRowsPerCluster,
            clusterLimitMode: inputs.clusterLimitMode
          })
        });

        if (!createResponse.ok) {
          throw new Error("Failed to create Stage 1 project");
        }
        const created = await createResponse.json();
        activeProjectId = created.projectId;
        setProjectId(created.projectId);
      }

      const clusterResponse = await fetch(
        `/api/stage1/projects/${activeProjectId}/clusters`,
        { method: "POST" }
      );
      if (!clusterResponse.ok) {
        throw new Error("Failed to generate clusters");
      }

      const data = await clusterResponse.json();
      const clusterList = (data.clusters ?? []).map((cluster: any) => ({
        ...cluster,
        selected: false
      }));
      const sorted = [...clusterList].sort(
        (a, b) => (b.score ?? 0) - (a.score ?? 0)
      );
      const autoSelectedIds = sorted.slice(0, 10).map((cluster) => cluster.id);
      const withSelection = clusterList.map((cluster: any) => ({
        ...cluster,
        selected: autoSelectedIds.includes(cluster.id)
      }));
      setStage1Clusters(withSelection);
      setStage1Keywords([]);
      setDataForSeoStatus(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setClusterLoading(false);
    }
  };

  const handleRunKeywords = async () => {
    if (!projectId) {
      setError("Generate clusters first.");
      return;
    }
    if (!selectedIds.length) {
      setError("Select at least one cluster.");
      return;
    }

    setError(null);
    setKeywordLoading(true);
    setDataForSeoStatus({
      status: "queued",
      message: "Queued for DataForSEO metrics."
    });
    try {
      await fetch(`/api/stage1/projects/${projectId}/selection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedIds })
      });

      const keywordResponse = await fetch(
        `/api/stage1/projects/${projectId}/keywords`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selectedIds,
            inputOverrides: {
              country: inputs.country,
              minVolumeEnabled: inputs.minVolumeEnabled,
              maxClusters: inputs.maxClusters,
              maxRowsPerCluster: inputs.maxRowsPerCluster,
              clusterLimitMode: inputs.clusterLimitMode
            }
          })
        }
      );

      if (!keywordResponse.ok) {
        throw new Error("Failed to generate keywords");
      }

      const data = await keywordResponse.json();
      setStage1Keywords(data.rows ?? []);
      setDataForSeoStatus(data.dataForSeo ?? null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setKeywordLoading(false);
    }
  };

  const handleTestDataForSeo = async () => {
    setDataForSeoTesting(true);
    setError(null);
    setDataForSeoStatus({
      status: "queued",
      message: "Queued for DataForSEO connectivity check."
    });
    try {
      const response = await fetch(
        `/api/dataforseo/test?country=${encodeURIComponent(inputs.country)}`
      );
      if (!response.ok) {
        throw new Error("DataForSEO test failed.");
      }
      const data = await response.json();
      setDataForSeoStatus(data);
    } catch (error) {
      setDataForSeoStatus({
        status: "error",
        message: error instanceof Error ? error.message : "DataForSEO test failed."
      });
    } finally {
      setDataForSeoTesting(false);
    }
  };

  const handleSanityCheck = async () => {
    setDataForSeoSanityLoading(true);
    setError(null);
    setDataForSeoStatus({
      status: "queued",
      message: "Queued for DataForSEO sanity check."
    });
    try {
      const response = await fetch("/api/dataforseo/sanity");
      if (!response.ok) {
        throw new Error("Sanity check failed.");
      }
      const data = await response.json();
      setDataForSeoStatus(data);
    } catch (error) {
      setDataForSeoStatus({
        status: "error",
        message: error instanceof Error ? error.message : "Sanity check failed."
      });
    } finally {
      setDataForSeoSanityLoading(false);
    }
  };

  const handleLoadDiagnostics = async () => {
    setDiagnosticsLoading(true);
    setDiagnosticsError(null);
    try {
      const [errorsResponse, idListResponse] = await Promise.all([
        fetch("/api/dataforseo/errors"),
        fetch("/api/dataforseo/id_list")
      ]);
      if (!errorsResponse.ok || !idListResponse.ok) {
        throw new Error("Failed to load diagnostics.");
      }
      const [errorsData, idListData] = await Promise.all([
        errorsResponse.json(),
        idListResponse.json()
      ]);
      setDiagnosticsData({ errors: errorsData, idList: idListData });
    } catch (error) {
      setDiagnosticsError(
        error instanceof Error ? error.message : "Diagnostics failed."
      );
    } finally {
      setDiagnosticsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Keyword Cluster Engine</h1>
            <p className="text-xs text-slate-400">
              Minimal inputs → clusters → keyword metrics
            </p>
            <p className="mt-1 max-w-xl text-xs text-slate-300">
              Complete the inputs panel below. This will create your{" "}
              <strong>Clusters</strong> when you click Generate Clusters, then
              select which Clusters you want to run keywords against and click
              Run Keyword Analysis.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Note: Selecting all Clusters will return a smaller number of
              keywords per cluster due to rate limiting.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded border border-green-800 bg-green-900 px-3 py-2 text-xs uppercase tracking-widest text-slate-100 hover:bg-green-700 active:bg-green-700 disabled:opacity-50"
              onClick={handleGenerateClusters}
              disabled={clusterLoading}
            >
              {clusterLoading ? "Generating..." : "Generate Clusters"}
            </button>
            <button
              className="rounded border border-green-800 bg-green-900 px-3 py-2 text-xs uppercase tracking-widest text-slate-100 hover:bg-green-700 active:bg-green-700 disabled:opacity-50"
              onClick={handleRunKeywords}
              disabled={keywordLoading}
            >
              {keywordLoading ? "Running..." : "Run Keyword Analysis"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-6">
          {error && (
            <div className="rounded border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
              {error}
            </div>
          )}
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="text-sm font-semibold text-slate-200">
              Inputs (Stage 1)
            </h2>
            <div className="mt-4 grid gap-4">
              <div>
                <label className="text-xs uppercase text-slate-400">
                  Target URL
                </label>
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  value={inputs.targetUrl}
                  onChange={(event) =>
                    handleInputChange("targetUrl", event.target.value)
                  }
                  placeholder="https://the-website-landing-page-of-your-client.com"
                />
              </div>
              <div>
                <label className="text-xs uppercase text-slate-400">
                  Competitor URLs (one per line)
                </label>
                <textarea
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  rows={4}
                  value={inputs.competitors}
                  onChange={(event) =>
                    handleInputChange("competitors", event.target.value)
                  }
                />
              </div>
              <div>
                <label className="text-xs uppercase text-slate-400">
                  Initial categories/clusters (optional)
                </label>
                <textarea
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  rows={3}
                  value={inputs.initialClusters}
                  onChange={(event) =>
                    handleInputChange("initialClusters", event.target.value)
                  }
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-xs uppercase text-slate-400">
                    Industry
                  </label>
                  <input
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    value={inputs.industry}
                    onChange={(event) =>
                      handleInputChange("industry", event.target.value)
                    }
                    placeholder="Beauty"
                  />
                </div>
                <div>
                  <label className="text-xs uppercase text-slate-400">
                    Target audience
                  </label>
                  <input
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                    value={inputs.audience}
                    onChange={(event) =>
                      handleInputChange("audience", event.target.value)
                    }
                    placeholder="Consumers, estheticians"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs uppercase text-slate-400">
                  Country
                </label>
                <select
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  value={inputs.country}
                  onChange={(event) =>
                    handleInputChange(
                      "country",
                      event.target.value as "UK" | "US"
                    )
                  }
                >
                  <option value="UK">United Kingdom</option>
                  <option value="US">United States</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase text-slate-400">
                  Constraints / exclusions
                </label>
                <textarea
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  rows={3}
                  value={inputs.constraints}
                  onChange={(event) =>
                    handleInputChange("constraints", event.target.value)
                  }
                  placeholder="brand terms, phrases to exclude"
                />
              </div>
              <div>
                <label className="text-xs uppercase text-slate-400">
                  Minimum search volume filter
                </label>
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-200">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="min-volume"
                      checked={inputs.minVolumeEnabled}
                      onChange={() => handleInputChange("minVolumeEnabled", true)}
                    />
                    Exclude keywords with volume below 10
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="min-volume"
                      checked={!inputs.minVolumeEnabled}
                      onChange={() =>
                        handleInputChange("minVolumeEnabled", false)
                      }
                    />
                    Include all volumes
                  </label>
                </div>
              </div>
              <div className="rounded border border-slate-800 bg-slate-950/60 p-3">
                <label className="text-xs uppercase text-slate-400">
                  Cluster limits (DataForSEO safety)
                </label>
                <div className="mt-3 grid gap-3 text-xs text-slate-200">
                  <div>
                    <label className="text-[11px] uppercase text-slate-500">
                      Limit mode
                    </label>
                    <select
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                      value={inputs.clusterLimitMode}
                      onChange={(event) =>
                        handleInputChange(
                          "clusterLimitMode",
                          event.target.value as "top" | "banded" | "none"
                        )
                      }
                    >
                      <option value="top">Top clusters (by score)</option>
                      <option value="banded">
                        Banded by intent stage (balanced)
                      </option>
                      <option value="none">No limit</option>
                    </select>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-[11px] uppercase text-slate-500">
                        Max clusters used
                      </label>
                      <input
                        className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
                        type="number"
                        min={0}
                        value={inputs.maxClusters}
                        disabled={inputs.clusterLimitMode === "none"}
                        onChange={(event) =>
                          handleInputChange(
                            "maxClusters",
                            parseNumberInput(event.target.value, 0)
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[11px] uppercase text-slate-500">
                        Max keywords per cluster
                      </label>
                      <input
                        className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                        type="number"
                        min={0}
                        value={inputs.maxRowsPerCluster}
                        onChange={(event) =>
                          handleInputChange(
                            "maxRowsPerCluster",
                            parseNumberInput(event.target.value, 0)
                          )
                        }
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Use 0 to disable a limit. Banded mode spreads the cap across
                    intent stages.
                  </p>
                </div>
              </div>
              <div>
                <label className="text-xs uppercase text-slate-400">
                  Market type
                </label>
                <select
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  value={inputs.marketType}
                  onChange={(event) =>
                    handleInputChange(
                      "marketType",
                      event.target.value as "b2b" | "b2c"
                    )
                  }
                >
                  <option value="b2c">B2C</option>
                  <option value="b2b">B2B</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Project</span>
              <span className="text-slate-200">
                {projectId ? projectId.slice(0, 8) : "Not created"}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <h3 className="text-sm font-semibold text-slate-200">
              Cluster suggestions
            </h3>
            {clusters.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                Generate clusters to see suggestions.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    className="rounded border border-green-800 bg-green-900 px-2 py-1 text-xs text-slate-100 hover:bg-green-700 active:bg-green-700 disabled:opacity-50"
                    onClick={() =>
                      setStage1ClusterSelection(
                        clusters.map((cluster) => cluster.id)
                      )
                    }
                    disabled={!clusters.length}
                  >
                    Select all
                  </button>
                  <button
                    className="rounded border border-green-800 bg-green-900 px-2 py-1 text-xs text-slate-100 hover:bg-green-700 active:bg-green-700 disabled:opacity-50"
                    onClick={() => setStage1ClusterSelection([])}
                    disabled={!clusters.length}
                  >
                    Select none
                  </button>
                  {projectId && clusters.length > 0 && (
                    <a
                      className="rounded border border-green-800 bg-green-900 px-2 py-1 text-xs text-slate-100 hover:bg-green-700 active:bg-green-700"
                      href={`/api/stage1/projects/${projectId}/clusters?format=csv`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Download Clusters CSV
                    </a>
                  )}
                </div>
                <div className="space-y-2">
                  {clusters.map((cluster) => (
                    <label
                      key={cluster.id}
                      className="flex items-start gap-2 rounded border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={!!cluster.selected}
                        onChange={() => toggleStage1Cluster(cluster.id)}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{cluster.name}</span>
                          {cluster.intentStage && (
                            <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] uppercase text-slate-300">
                              {cluster.intentStage}
                            </span>
                          )}
                        </div>
                        {cluster.concern && (
                          <div className="text-[10px] text-slate-500">
                            Concern: {cluster.concern}
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">
                DataForSEO Diagnostics
              </h3>
              <button
                className="rounded border border-green-800 bg-green-900 px-2 py-1 text-xs text-slate-100 hover:bg-green-700 active:bg-green-700 disabled:opacity-50"
                onClick={handleLoadDiagnostics}
                disabled={diagnosticsLoading}
              >
                {diagnosticsLoading ? "Loading..." : "Load"}
              </button>
            </div>
            {diagnosticsError && (
              <div className="mt-2 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-100">
                {diagnosticsError}
              </div>
            )}
            {!diagnosticsData && !diagnosticsError && (
              <p className="mt-2 text-xs text-slate-500">
                Load recent DataForSEO errors and task history.
              </p>
            )}
            {diagnosticsData && (
              <div className="mt-3 space-y-3 text-[10px] text-slate-300">
                <div>
                  <div className="text-[11px] font-semibold text-slate-200">
                    Errors
                  </div>
                  <pre className="mt-1 max-h-48 overflow-auto rounded border border-slate-800 bg-slate-950/60 p-2">
                    {JSON.stringify(diagnosticsData.errors, null, 2)}
                  </pre>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-slate-200">
                    Task History (id_list)
                  </div>
                  <pre className="mt-1 max-h-48 overflow-auto rounded border border-slate-800 bg-slate-950/60 p-2">
                    {JSON.stringify(diagnosticsData.idList, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </aside>
      </main>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-200">
              Keyword results
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="rounded border border-green-800 bg-green-900 px-3 py-1 text-xs uppercase text-slate-100 hover:bg-green-700 active:bg-green-700 disabled:opacity-50"
                onClick={handleTestDataForSeo}
                disabled={dataForSeoTesting}
              >
                {dataForSeoTesting ? "Testing..." : "Test DataForSEO"}
              </button>
              <button
                className="rounded border border-green-800 bg-green-900 px-3 py-1 text-xs uppercase text-slate-100 hover:bg-green-700 active:bg-green-700 disabled:opacity-50"
                onClick={handleSanityCheck}
                disabled={dataForSeoSanityLoading}
              >
                {dataForSeoSanityLoading ? "Checking..." : "Metrics sanity check"}
              </button>
              {projectId && keywords.length > 0 && (
                <a
                  className="rounded border border-green-800 bg-green-900 px-3 py-1 text-xs uppercase text-slate-100 hover:bg-green-700 active:bg-green-700"
                  href={`/api/stage1/projects/${projectId}/keywords?format=csv`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download CSV
                </a>
              )}
            </div>
          </div>
          {dataForSeoStatus?.status === "empty" && (
            <div className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              {dataForSeoStatus.message ??
                "DataForSEO returned zero items. Metrics will be blank."}
            </div>
          )}
          {dataForSeoStatus?.status === "error" && (
            <div className="mt-3 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              DataForSEO error: {dataForSeoStatus.message ?? "Unknown error."}
            </div>
          )}
          {dataForSeoStatus?.status === "queued" && (
            <div className="mt-3 rounded border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-100">
              {dataForSeoStatus.message ?? "Queued for DataForSEO."}
            </div>
          )}
          {dataForSeoStatus?.status === "ok" && (
            <div className="mt-3 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
              DataForSEO connected. Metrics available.
            </div>
          )}
          {keywords.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Run keyword analysis to populate results.
            </p>
          ) : (
            <div className="mt-4 overflow-auto">
              <table className="min-w-full text-left text-xs text-slate-200">
                <thead className="text-[10px] uppercase text-slate-400">
                  <tr>
                    {[
                      "Keyword",
                      "Search Volume",
                      "CPC",
                      "Competition",
                      "Intent Stage",
                      "Source Type (brand/generic)",
                      "Competitor",
                      "Cluster",
                      "Concern"
                    ].map((header) => (
                      <th key={header} className="px-2 py-2">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keywords.slice(0, 50).map((row, index) => (
                    <tr key={`${row.Keyword}-${index}`} className="border-t border-slate-800">
                      <td className="px-2 py-2">{row.Keyword}</td>
                      <td className="px-2 py-2">{row["Search Volume"] ?? ""}</td>
                      <td className="px-2 py-2">{row.CPC ?? ""}</td>
                      <td className="px-2 py-2">{row.Competition ?? ""}</td>
                      <td className="px-2 py-2">{row["Intent Stage"] ?? ""}</td>
                      <td className="px-2 py-2">
                        {row["Source Type (brand/generic)"] ?? ""}
                      </td>
                      <td className="px-2 py-2">{row.Competitor ?? ""}</td>
                      <td className="px-2 py-2">{row.Cluster ?? ""}</td>
                      <td className="px-2 py-2">{row.Concern ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {keywords.length > 50 && (
                <p className="mt-2 text-[10px] text-slate-500">
                  Showing first 50 rows. Download CSV for full output.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-12">
        <details className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">
            General Info
          </summary>
          <ul className="mt-3 space-y-2 text-xs text-slate-300">
            <li>
              <span className="text-slate-200">Cluster score:</span> A model-provided
              ranking hint (0-100). It controls sorting and auto-selection only.
            </li>
            <li>
              <span className="text-slate-200">Project ID:</span> Created when you
              click Generate Clusters. It ties inputs/outputs to one record.
            </li>
            <li>
              <span className="text-slate-200">Country:</span> Sets the DataForSEO
              location code (UK/US), which affects volumes and CPC.
            </li>
            <li>
              <span className="text-slate-200">Min volume filter:</span> When enabled,
              keywords under volume 10 are excluded.
            </li>
            <li>
              <span className="text-slate-200">Rate limiting:</span> Selecting all
              clusters can reduce per-cluster output to avoid limits.
            </li>
            <li>
              <span className="text-slate-200">Keyword sanitation:</span> Invalid
              characters are stripped before sending to DataForSEO.
            </li>
            <li>
              <span className="text-slate-200">Downloads:</span> Cluster CSV is
              available after clusters are generated; Keyword CSV after analysis.
            </li>
          </ul>
        </details>
      </section>
    </div>
  );
}
