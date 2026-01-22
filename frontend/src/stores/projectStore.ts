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

export interface Stage1Inputs {
  targetUrl: string;
  competitors: string;
  initialClusters: string;
  industry: string;
  audience: string;
  constraints: string;
  country: "UK" | "US";
  minVolumeEnabled: boolean;
  marketType: "b2b" | "b2c";
  maxClusters: number;
  maxRowsPerCluster: number;
  clusterLimitMode: "top" | "banded" | "none";
}

export interface Stage1Cluster {
  id: string;
  name: string;
  intentStage?: string;
  concern?: string;
  score?: number;
  selected?: boolean;
}

export interface Stage1KeywordRow {
  Keyword: string;
  "Search Volume"?: number | string;
  CPC?: number | string;
  Competition?: number | string;
  "Intent Stage"?: string;
  "Source Type (brand/generic)"?: string;
  Competitor?: string;
  "Competitors Bidding"?: string;
  Cluster?: string;
  Concern?: string;
}

interface ProjectStore {
  projectId: string | null;
  steps: StepState[];
  outputs: OutputStatus[];
  stage1Inputs: Stage1Inputs;
  stage1Clusters: Stage1Cluster[];
  stage1Keywords: Stage1KeywordRow[];
  setProjectId: (id: string) => void;
  setStepStatus: (id: string, status: StepState["status"]) => void;
  setOutputStatus: (id: string, status: AgentStatus, detail?: string) => void;
  setStage1Inputs: (inputs: Stage1Inputs) => void;
  setStage1Clusters: (clusters: Stage1Cluster[]) => void;
  setStage1Keywords: (rows: Stage1KeywordRow[]) => void;
  toggleStage1Cluster: (id: string) => void;
  setStage1ClusterSelection: (ids: string[]) => void;
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

const defaultStage1Inputs: Stage1Inputs = {
  targetUrl: "",
  competitors: "",
  initialClusters: "",
  industry: "",
  audience: "",
  constraints: "",
  country: "UK",
  minVolumeEnabled: true,
  marketType: "b2c",
  maxClusters: 12,
  maxRowsPerCluster: 50,
  clusterLimitMode: "top"
};

export const useProjectStore = create<ProjectStore>((set) => ({
  projectId: null,
  steps: defaultSteps,
  outputs: defaultOutputs,
  stage1Inputs: defaultStage1Inputs,
  stage1Clusters: [],
  stage1Keywords: [],
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
    })),
  setStage1Inputs: (inputs) => set({ stage1Inputs: inputs }),
  setStage1Clusters: (clusters) => set({ stage1Clusters: clusters }),
  setStage1Keywords: (rows) => set({ stage1Keywords: rows }),
  toggleStage1Cluster: (id) =>
    set((state) => ({
      stage1Clusters: state.stage1Clusters.map((cluster) =>
        cluster.id === id
          ? { ...cluster, selected: !cluster.selected }
          : cluster
      )
    })),
  setStage1ClusterSelection: (ids) =>
    set((state) => ({
      stage1Clusters: state.stage1Clusters.map((cluster) => ({
        ...cluster,
        selected: ids.includes(cluster.id)
      }))
    }))
}));
