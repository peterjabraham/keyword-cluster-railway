import { projectCreateSchema } from "../shared/schemas";
import { badRequest, jsonResponse, optionsResponse } from "../shared/utils";

interface Env {
  DB: D1Database;
  SESSION_CACHE: KVNamespace;
  URL_EXTRACTOR: Fetcher;
  COMPETITOR_ANALYZER: Fetcher;
  DATA_CONNECTOR: Fetcher;
}

type ProjectStatus = {
  projectId: string;
  agents: Record<string, "waiting" | "processing" | "ready" | "error">;
};

const statusStore = new Map<string, ProjectStatus>();

function getProjectStatus(projectId: string) {
  const existing = statusStore.get(projectId);
  if (existing) {
    return existing;
  }
  const created: ProjectStatus = {
    projectId,
    agents: {
      urlExtractor: "waiting",
      competitorAnalyzer: "waiting",
      dataConnector: "waiting",
      keywordExpander: "waiting",
      clusteringEngine: "waiting",
      intentClassifier: "waiting",
      userStateRouter: "waiting"
    }
  };
  statusStore.set(projectId, created);
  return created;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return optionsResponse();
    }

    if (request.method === "POST" && pathname === "/api/projects") {
      const body = await request.json().catch(() => null);
      const parsed = projectCreateSchema.safeParse(body);
      if (!parsed.success) {
        return badRequest("Invalid project payload", parsed.error.format());
      }

      const projectId = crypto.randomUUID();
      const status = getProjectStatus(projectId);
      await env.SESSION_CACHE.put(
        `project:${projectId}`,
        JSON.stringify({ id: projectId, ...parsed.data })
      );

      return jsonResponse({ projectId, status });
    }

    if (request.method === "POST" && pathname.endsWith("/run")) {
      const parts = pathname.split("/").filter(Boolean);
      const projectId = parts[2];
      if (!projectId) {
        return badRequest("Missing project id");
      }

      const status = getProjectStatus(projectId);
      status.agents.urlExtractor = "processing";
      status.agents.competitorAnalyzer = "processing";
      status.agents.dataConnector = "processing";
      statusStore.set(projectId, status);

      return jsonResponse({ projectId, status, queued: true });
    }

    if (request.method === "GET" && pathname.includes("/status")) {
      const parts = pathname.split("/").filter(Boolean);
      const projectId = parts[2];
      if (!projectId) {
        return badRequest("Missing project id");
      }
      return jsonResponse(getProjectStatus(projectId));
    }

    if (request.method === "GET" && pathname.includes("/outputs/")) {
      const parts = pathname.split("/").filter(Boolean);
      const projectId = parts[2];
      const type = parts[4];
      if (!projectId || !type) {
        return badRequest("Missing project id or output type");
      }
      return jsonResponse({
        projectId,
        type,
        payload: [],
        note: "Output placeholders until agents are wired."
      });
    }

    return jsonResponse({ message: "SEO Clustering Orchestrator" });
  }
};
