import { useState } from "react";
import { StepWizard } from "./components/StepWizard";
import { OutputPanel } from "./components/OutputPanel";
import { ProjectContext } from "./components/ProjectContext";
import { URLConfig } from "./components/URLConfig";
import { AudienceConfig } from "./components/AudienceConfig";
import { ConstraintsConfig } from "./components/ConstraintsConfig";
import { DataSourceConfig } from "./components/DataSourceConfig";
import { UserStateConfig } from "./components/UserStateConfig";
import { useProjectStore } from "./stores/projectStore";
import { useAgentStatus } from "./hooks/useAgentStatus";

export default function App() {
  const steps = useProjectStore((state) => state.steps);
  const projectId = useProjectStore((state) => state.projectId);
  const setProjectId = useProjectStore((state) => state.setProjectId);
  const setOutputStatus = useProjectStore((state) => state.setOutputStatus);
  const { outputs, readyCount, total } = useAgentStatus();
  const [loading, setLoading] = useState(false);

  const [projectContext, setProjectContext] = useState({
    channel: "",
    motion: "",
    conversion: "",
    metric: ""
  });
  const [urlConfig, setUrlConfig] = useState({
    domain: "",
    moneyPages: "",
    competitors: ""
  });
  const [audienceConfig, setAudienceConfig] = useState({
    buyer: "",
    champion: "",
    economicBuyer: "",
    verticals: ""
  });
  const [constraintsConfig, setConstraintsConfig] = useState({
    excluded: "",
    mustHave: "",
    proofAssets: ""
  });
  const [dataSources, setDataSources] = useState({
    gsc: "",
    ga4: "",
    ads: "",
    crm: ""
  });
  const [userStates, setUserStates] = useState({
    jobs: "",
    constraints: "",
    outcomes: ""
  });

  const parseLines = (value: string) =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  const handleRun = async () => {
    if (!urlConfig.domain) {
      alert("Please enter a target domain.");
      return;
    }

    setLoading(true);
    try {
      const projectResponse = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: urlConfig.domain,
          domain: urlConfig.domain
        })
      });

      if (!projectResponse.ok) {
        throw new Error("Failed to create project");
      }

      const projectData = await projectResponse.json();
      setProjectId(projectData.projectId);

      const runResponse = await fetch(
        `/api/projects/${projectData.projectId}/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectContext,
            urls: {
              targetDomain: urlConfig.domain,
              moneyPages: parseLines(urlConfig.moneyPages),
              competitors: parseLines(urlConfig.competitors)
            },
            audience: {
              buyer: audienceConfig.buyer,
              champion: audienceConfig.champion,
              economicBuyer: audienceConfig.economicBuyer,
              verticals: audienceConfig.verticals
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
            },
            constraints: {
              exclude: parseLines(constraintsConfig.excluded),
              mustHave: parseLines(constraintsConfig.mustHave),
              proofAssets: parseLines(constraintsConfig.proofAssets)
            },
            dataSources,
            userStates: {
              jobs: parseLines(userStates.jobs),
              constraints: parseLines(userStates.constraints),
              outcomes: parseLines(userStates.outcomes)
            }
          })
        }
      );

      if (!runResponse.ok) {
        throw new Error("Failed to run pipeline");
      }

      const runData = await runResponse.json();
      Object.entries(runData.status ?? {}).forEach(([key, value]) => {
        const outputMap: Record<string, string> = {
          urlExtractor: "competitor",
          competitorAnalyzer: "competitor",
          dataConnector: "competitor",
          keywordExpander: "taxonomy",
          clusteringEngine: "taxonomy",
          intentClassifier: "routing",
          userStateRouter: "routing"
        };
        const outputId = outputMap[key];
        if (outputId) {
          setOutputStatus(outputId, value === "ready" ? "ready" : "processing");
        }
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">SEO Clustering Engine</h1>
            <p className="text-xs text-slate-400">
              Agent-based pipeline with progressive outputs
            </p>
          </div>
          <button
            className="rounded border border-slate-700 px-3 py-2 text-xs uppercase tracking-widest text-slate-200 disabled:opacity-50"
            onClick={handleRun}
            disabled={loading}
          >
            {loading ? "Running..." : "Run Pipeline"}
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <StepWizard steps={steps} />
          <ProjectContext
            values={projectContext}
            onChange={setProjectContext}
          />
          <URLConfig values={urlConfig} onChange={setUrlConfig} />
          <AudienceConfig
            values={audienceConfig}
            onChange={setAudienceConfig}
          />
          <ConstraintsConfig
            values={constraintsConfig}
            onChange={setConstraintsConfig}
          />
          <DataSourceConfig values={dataSources} onChange={setDataSources} />
          <UserStateConfig values={userStates} onChange={setUserStates} />
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">
                {projectId ? "Project" : "Agents ready"}
              </span>
              <span className="text-slate-200">
                {projectId ? projectId.slice(0, 8) : `${readyCount} / ${total}`}
              </span>
            </div>
          </div>
          <OutputPanel outputs={outputs} />
        </aside>
      </main>
    </div>
  );
}
