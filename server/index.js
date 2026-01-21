const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));

const projectStore = new Map();

const defaultAgentStatus = () => ({
  urlExtractor: "waiting",
  competitorAnalyzer: "waiting",
  dataConnector: "waiting",
  keywordExpander: "waiting",
  clusteringEngine: "waiting",
  intentClassifier: "waiting",
  userStateRouter: "waiting"
});

function createProject(payload) {
  const projectId = crypto.randomUUID();
  const project = {
    id: projectId,
    payload,
    status: defaultAgentStatus(),
    outputs: {}
  };
  projectStore.set(projectId, project);
  return project;
}

function getProject(projectId) {
  return projectStore.get(projectId);
}

function setStatus(project, agent, status) {
  project.status[agent] = status;
}

async function openaiJson(prompt, system) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function dataForSeoKeywords(seedKeywords) {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    return [];
  }

  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const response = await fetch(
    "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([
        {
          location_code: 2840,
          language_code: "en",
          keywords: seedKeywords,
          include_serp_info: false
        }
      ])
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DataForSEO error: ${error}`);
  }

  const data = await response.json();
  const items = data?.tasks?.[0]?.result?.[0]?.items ?? [];
  return items.map((item) => item.keyword).filter(Boolean);
}

async function runPipeline(project) {
  const { payload } = project;

  setStatus(project, "urlExtractor", "processing");
  const urlExtractorOutput = {
    navigation: [],
    pageThemes: payload?.urls?.moneyPages?.map((url) => ({
      url,
      theme: "Money Page"
    })) ?? [],
    h1h2Patterns: [],
    proofPages: [],
    useCasePages: []
  };
  project.outputs.urlExtractor = urlExtractorOutput;
  setStatus(project, "urlExtractor", "ready");

  setStatus(project, "competitorAnalyzer", "processing");
  const competitorOutput = {
    featureFlags: {
      competitors: (payload?.urls?.competitors ?? []).map((domain) => ({
        domain,
        features: { pricing: false, demo: false },
        urls: {}
      })),
      gaps: []
    },
    pageTypeInventory: [],
    missingClusters: [],
    proofPatterns: []
  };
  project.outputs.competitorAnalyzer = competitorOutput;
  setStatus(project, "competitorAnalyzer", "ready");

  setStatus(project, "dataConnector", "processing");
  const dataConnectorOutput = {
    queryTerms: [],
    searchPatterns: [],
    conversionPaths: [],
    voiceOfCustomer: []
  };
  project.outputs.dataConnector = dataConnectorOutput;
  setStatus(project, "dataConnector", "ready");

  setStatus(project, "keywordExpander", "processing");
  const seedFamilies = urlExtractorOutput.pageThemes.map((theme) => theme.theme);
  const openAiExpansion =
    (await openaiJson(
      `Expand these seed families into keyword families: ${seedFamilies.join(
        ", "
      )}. Return JSON with { expandedKeywords: string[], suggestedQueries: string[] }.`,
      "You are a keyword expansion engine. Only return JSON."
    )) ?? {};
  const dataForSeoSuggestions = await dataForSeoKeywords(seedFamilies);
  const expandedKeywords = [
    ...(openAiExpansion.expandedKeywords ?? []),
    ...dataForSeoSuggestions
  ];
  project.outputs.keywordExpander = {
    expandedKeywords,
    suggestedQueries: openAiExpansion.suggestedQueries ?? [],
    serpSuggestions: dataForSeoSuggestions
  };
  setStatus(project, "keywordExpander", "ready");

  setStatus(project, "clusteringEngine", "processing");
  const clusteringOutput = {
    taxonomy: {
      L1: [{ id: "l1-core", name: "Core", children: ["l2-seed"] }],
      L2: [
        {
          id: "l2-seed",
          parentId: "l1-core",
          name: "Seed",
          children: ["l3-seed"]
        }
      ],
      L3: [
        {
          id: "l3-seed",
          parentId: "l2-seed",
          name: "Seed Keywords",
          children: []
        }
      ]
    },
    assignments: expandedKeywords.map((keyword) => ({
      keyword,
      clusterId: "l3-seed",
      intent: "commercial"
    }))
  };
  project.outputs.clusteringEngine = clusteringOutput;
  setStatus(project, "clusteringEngine", "ready");

  setStatus(project, "intentClassifier", "processing");
  const intentResponse =
    (await openaiJson(
      `Classify intent for these keywords: ${expandedKeywords
        .slice(0, 50)
        .join(", ")}. Return JSON with { intentTags: string[], serpPageTypes: string[], evidenceRequired: string[] }.`,
      "You are an intent classification engine. Only return JSON."
    )) ?? {};
  project.outputs.intentClassifier = {
    intentTags: intentResponse.intentTags ?? ["commercial"],
    serpPageTypes: intentResponse.serpPageTypes ?? [],
    evidenceRequired: intentResponse.evidenceRequired ?? []
  };
  setStatus(project, "intentClassifier", "ready");

  setStatus(project, "userStateRouter", "processing");
  const routerResponse =
    (await openaiJson(
      `Given jobs=${payload?.userStates?.jobs ?? []}, constraints=${
        payload?.userStates?.constraints ?? []
      }, outcomes=${payload?.userStates?.outcomes ?? []}, propose routing rules. Return JSON with { routingTable: { job, constraint, outcome, pageType, cta }[], proofBlocks: string[] }.`,
      "You are a routing engine. Only return JSON."
    )) ?? {};
  project.outputs.userStateRouter = {
    routingTable: routerResponse.routingTable ?? [],
    pageRequirements: [],
    proofBlocks: routerResponse.proofBlocks ?? []
  };
  setStatus(project, "userStateRouter", "ready");

  return project;
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/projects", (req, res) => {
  const payload = req.body ?? {};
  if (!payload.name || !payload.domain) {
    return res.status(400).json({ error: "name and domain are required" });
  }
  const project = createProject(payload);
  return res.json({ projectId: project.id, status: project.status });
});

app.post("/api/projects/:id/run", async (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  project.payload = { ...project.payload, ...(req.body ?? {}) };
  try {
    await runPipeline(project);
    return res.json({ projectId: project.id, status: project.status });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/projects/:id/status", (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  return res.json({ projectId: project.id, status: project.status });
});

app.get("/api/projects/:id/outputs/:type", (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }
  const output = project.outputs[req.params.type];
  return res.json({ projectId: project.id, type: req.params.type, payload: output ?? [] });
});

const distPath = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
