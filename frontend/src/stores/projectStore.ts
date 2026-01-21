import { create } from "zustand";

export type AgentStatus = "waiting" | "processing" | "ready" | "error";

export interface StepState {
  id: string;
  title: string;
  status: "locked" | "current" | "done";
}

export interface OutputStatus {
  id: string;
  title: string;
  status: AgentStatus;
  detail: string;
}

interface ProjectStore {
  projectId: string | null;
  steps: StepState[];
  outputs: OutputStatus[];
  setProjectId: (id: string) => void;
  setStepStatus: (id: string, status: StepState["status"]) => void;
  setOutputStatus: (id: string, status: AgentStatus, detail?: string) => void;
}

const defaultSteps: StepState[] = [
  { id: "project", title: "Project Context", status: "current" },
  { id: "urls", title: "URLs & Pages", status: "locked" },
  { id: "audience", title: "Audience & Roles", status: "locked" },
  { id: "constraints", title: "Constraints & Proof", status: "locked" },
  { id: "data", title: "Data Sources", status: "locked" },
  { id: "router", title: "User State Router", status: "locked" }
];

const defaultOutputs: OutputStatus[] = [
  {
    id: "competitor",
    title: "Competitor Feature Matrix",
    status: "waiting",
    detail: "Waiting on extractor"
  },
  {
    id: "routing",
    title: "User-State Routing Table",
    status: "waiting",
    detail: "Waiting on intent classifier"
  },
  {
    id: "taxonomy",
    title: "Cluster Taxonomy",
    status: "waiting",
    detail: "Queued"
  },
  {
    id: "keywords",
    title: "Keyword List",
    status: "waiting",
    detail: "Waiting on taxonomy"
  },
  {
    id: "proof",
    title: "Evidence Blocks",
    status: "waiting",
    detail: "Waiting on router"
  }
];

export const useProjectStore = create<ProjectStore>((set) => ({
  projectId: null,
  steps: defaultSteps,
  outputs: defaultOutputs,
  setProjectId: (id) => set({ projectId: id }),
  setStepStatus: (id, status) =>
    set((state) => ({
      steps: state.steps.map((step) =>
        step.id === id ? { ...step, status } : step
      )
    })),
  setOutputStatus: (id, status, detail) =>
    set((state) => ({
      outputs: state.outputs.map((output) =>
        output.id === id
          ? { ...output, status, detail: detail ?? output.detail }
          : output
      )
    }))
}));
