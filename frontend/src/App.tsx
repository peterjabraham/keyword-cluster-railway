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
  const { outputs, readyCount, total } = useAgentStatus();

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
          <button className="rounded border border-slate-700 px-3 py-2 text-xs uppercase tracking-widest text-slate-200">
            Run Pipeline
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <StepWizard steps={steps} />
          <ProjectContext />
          <URLConfig />
          <AudienceConfig />
          <ConstraintsConfig />
          <DataSourceConfig />
          <UserStateConfig />
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">Agents ready</span>
              <span className="text-slate-200">
                {readyCount} / {total}
              </span>
            </div>
          </div>
          <OutputPanel outputs={outputs} />
        </aside>
      </main>
    </div>
  );
}
