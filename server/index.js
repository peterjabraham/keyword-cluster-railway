const crypto = require("crypto");
require("dotenv").config();
const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const {
  normalizeKeywordForDataForSeo,
  sanitizeKeywordList
} = require("./utils/keywordSanitizer");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined
});

const sseClients = new Map();

const defaultAgentStatus = () => ({
  urlExtractor: "waiting",
  competitorAnalyzer: "waiting",
  dataConnector: "waiting",
  keywordExpander: "waiting",
  clusteringEngine: "waiting",
  intentClassifier: "waiting",
  userStateRouter: "waiting"
});

const OUTPUT_TYPES = new Set([
  "competitor",
  "routing",
  "taxonomy",
  "keywords",
  "proof"
]);

const stopWords = new Set([
  "a",
  "an",
  "and",
  "the",
  "for",
  "to",
  "of",
  "on",
  "in",
  "with",
  "by",
  "vs",
  "vs.",
  "near",
  "best",
  "top",
  "how",
  "what"
]);

const safeJson = (value, fallback) => {
  if (!value) {
    return fallback;
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .trim();

const extractKeywordsFromUrl = (value) => {
  if (!value) {
    return [];
  }
  const cleaned = value
    .replace(/^https?:\/\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\.(co|com|uk|io|net|org)(\/|$)/g, " ");
  return cleaned
    .split(/[^a-z0-9]+/gi)
    .map((token) => token.toLowerCase())
    .filter(Boolean)
    .filter((token) => token.length > 2)
    .filter((token) => !stopWords.has(token));
};

const buildSeedFamilies = (payload, urlExtractorOutput) => {
  const seeds = new Set();
  const moneyPages = payload?.urls?.moneyPages ?? [];
  if (moneyPages.length) {
    urlExtractorOutput.pageThemes.forEach((theme) => seeds.add(theme.theme));
  }

  const targetDomain = payload?.urls?.targetDomain ?? payload?.domain ?? "";
  extractKeywordsFromUrl(targetDomain).forEach((term) => seeds.add(term));

  (payload?.urls?.competitors ?? []).forEach((url) => {
    extractKeywordsFromUrl(url).forEach((term) => seeds.add(term));
  });

  const verticals = payload?.audience?.verticals ?? [];
  verticals.forEach((vertical) => seeds.add(vertical.toLowerCase()));

  const goalSeeds = [
    payload?.projectContext?.conversion,
    payload?.projectContext?.metric,
    payload?.projectContext?.motion,
    payload?.projectContext?.channel
  ];
  goalSeeds
    .filter(Boolean)
    .forEach((item) => seeds.add(item.toString().toLowerCase()));

  return Array.from(seeds).filter(Boolean);
};

const extractBrandTerms = (urls = []) => {
  const terms = new Set();
  const tldParts = new Set(["co", "com", "uk", "io", "net", "org"]);
  urls.forEach((rawUrl) => {
    try {
      const host = new URL(rawUrl).hostname.replace(/^www\./, "");
      host
        .split(".")
        .map((token) => token.toLowerCase())
        .filter(Boolean)
        .filter((token) => !tldParts.has(token))
        .filter((token) => token.length > 2)
        .filter((token) => !stopWords.has(token))
        .forEach((token) => terms.add(token));
    } catch (error) {
      extractKeywordsFromUrl(rawUrl).forEach((term) => terms.add(term));
    }
  });
  return Array.from(terms);
};

const inferIntentStage = (keyword) => {
  const value = keyword.toLowerCase();
  const decisionTerms = [
    "buy",
    "price",
    "pricing",
    "order",
    "discount",
    "coupon",
    "deal",
    "quote",
    "demo",
    "trial",
    "subscribe",
    "sign up",
    "book"
  ];
  const considerationTerms = [
    "best",
    "top",
    "review",
    "reviews",
    "compare",
    "comparison",
    "vs",
    "versus",
    "alternatives",
    "ranking",
    "recommended"
  ];
  const awarenessTerms = [
    "what is",
    "how to",
    "benefits",
    "symptoms",
    "causes",
    "guide",
    "ideas"
  ];
  if (decisionTerms.some((term) => value.includes(term))) {
    return "decision";
  }
  if (considerationTerms.some((term) => value.includes(term))) {
    return "consideration";
  }
  if (awarenessTerms.some((term) => value.includes(term))) {
    return "awareness";
  }
  return "awareness";
};

const inferSourceType = (keyword, brandTerms) => {
  const value = keyword.toLowerCase();
  return brandTerms.some((term) => value.includes(term)) ? "brand" : "generic";
};

const findCompetitorMatch = (keyword, competitorBrands) => {
  const value = keyword.toLowerCase();
  const match = competitorBrands.find((term) => value.includes(term));
  return match ?? "";
};

const guessClusterForKeyword = (keyword, clusters) => {
  const value = keyword.toLowerCase();
  const matches = clusters
    .map((cluster) => ({ cluster, score: cluster.name.length }))
    .filter((entry) => value.includes(entry.cluster.name.toLowerCase()));
  if (matches.length) {
    matches.sort((a, b) => b.score - a.score);
    return matches[0].cluster;
  }
  return clusters[0] ?? { name: "General", concern: "" };
};

const limitClusters = (clusters = [], maxClusters = 0, mode = "none") => {
  const limit = Number(maxClusters ?? 0);
  if (!limit || limit <= 0 || clusters.length <= limit) {
    return clusters;
  }

  const sorted = [...clusters].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0)
  );

  if (mode !== "banded") {
    return sorted.slice(0, limit);
  }

  const grouped = sorted.reduce((acc, cluster) => {
    const key = (cluster.intentStage ?? "unknown").toLowerCase();
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(cluster);
    return acc;
  }, {});

  const stages = Object.keys(grouped);
  if (!stages.length) {
    return sorted.slice(0, limit);
  }

  const baseQuota = Math.floor(limit / stages.length);
  let remainder = limit - baseQuota * stages.length;
  const selection = [];

  stages.forEach((stage) => {
    const take = Math.min(grouped[stage].length, baseQuota);
    selection.push(...grouped[stage].slice(0, take));
  });

  if (remainder > 0) {
    const overflow = stages.flatMap((stage) => grouped[stage].slice(baseQuota));
    overflow.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    selection.push(...overflow.slice(0, remainder));
  }

  return selection.slice(0, limit);
};

const buildKeywordFallbackPrompt = (clusters, input) => ({
  system: "You generate keyword lists for SEO clustering.",
  prompt: `Return JSON only. For each cluster, return 8-12 keywords. Keep keywords concise and search-like.
Format: { "clusters": [ { "name": "...", "keywords": ["...", "..."] } ] }
Context: target=${input.targetUrl}, competitors=${(input.competitors ?? []).join(", ")}, industry=${input.industry ?? ""}, audience=${input.audience ?? ""}.
Clusters: ${clusters.map((cluster) => cluster.name).join(", ")}`
});

const dataForSeoTest = async (country) => {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error("Missing DataForSEO credentials.");
  }
  const locationCode = getLocationCode(country);
  const payload = [
    {
      location_code: locationCode,
      language_code: "en",
      keywords: ["lash serum"],
    }
  ];
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  const response = await fetch(
    "https://api.dataforseo.com/v3/keywords_data/google/search_volume/live",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );
  if (!response.ok) {
    throw new Error(`DataForSEO error: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const task = data?.tasks?.[0];
  if (!task) {
    throw new Error("DataForSEO response missing task");
  }
  const items = task?.result?.[0]?.items ?? task?.result ?? [];
  return {
    statusCode: task.status_code,
    statusMessage: task.status_message ?? "",
    itemsCount: items.length
  };
};
const broadcast = (projectId, payload) => {
  const clients = sseClients.get(projectId);
  if (!clients) {
    return;
  }
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  clients.forEach((res) => {
    res.write(data);
  });
};

async function createProject(payload) {
  const projectId = crypto.randomUUID();
  const status = defaultAgentStatus();
  await pool.query(
    `INSERT INTO projects (id, name, domain, status, status_json)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      projectId,
      payload.name ?? payload.domain ?? "Untitled",
      payload.domain ?? "",
      "pending",
      JSON.stringify(status)
    ]
  );
  return { id: projectId, status };
}

async function getProjectStatus(projectId) {
  const result = await pool.query(
    "SELECT status_json, status FROM projects WHERE id = $1",
    [projectId]
  );
  if (!result.rows.length) {
    return null;
  }
  const row = result.rows[0];
  return safeJson(row.status_json ?? row.status, defaultAgentStatus());
}

async function updateProjectStatus(projectId, status) {
  await pool.query(
    "UPDATE projects SET status_json = $2, updated_at = NOW() WHERE id = $1",
    [projectId, JSON.stringify(status)]
  );
  broadcast(projectId, { type: "status", status });
}

async function setStatus(projectId, status, agent, nextStatus) {
  status[agent] = nextStatus;
  await updateProjectStatus(projectId, status);
}

async function saveOutput(projectId, outputType, payload) {
  await pool.query(
    `INSERT INTO project_outputs (project_id, output_type, payload, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (project_id, output_type)
     DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
    [projectId, outputType, JSON.stringify(payload)]
  );
  broadcast(projectId, { type: "output", outputType, payload });
}

async function getOutput(projectId, outputType) {
  const result = await pool.query(
    "SELECT payload FROM project_outputs WHERE project_id = $1 AND output_type = $2",
    [projectId, outputType]
  );
  if (!result.rows.length) {
    return null;
  }
  return safeJson(result.rows[0].payload, null);
}

async function openaiJson(prompt, system) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const supportsTemperature = !model.startsWith("gpt-5");
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt }
    ]
  };
  if (supportsTemperature) {
    body.temperature = 0.3;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
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

const locationCodeMap = {
  UK: 2826,
  US: 2840
};

const getLocationCode = (country) =>
  locationCodeMap[country] ?? locationCodeMap.UK;

const dataForSeoLimiter = {
  lastRequestAt: 0,
  minIntervalMs: 6000,
  queue: Promise.resolve()
};

const scheduleDataForSeo = (task) => {
  dataForSeoLimiter.queue = dataForSeoLimiter.queue.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(
      0,
      dataForSeoLimiter.minIntervalMs - (now - dataForSeoLimiter.lastRequestAt)
    );
    if (waitMs) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    dataForSeoLimiter.lastRequestAt = Date.now();
    return task();
  });
  return dataForSeoLimiter.queue;
};

const fetchDataForSeo = async (endpoint, payload) => {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    throw new Error("Missing DataForSEO credentials.");
  }
  const auth = Buffer.from(`${login}:${password}`).toString("base64");
  return scheduleDataForSeo(async () => {
    const response = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DataForSEO error: ${error}`);
    }
    const data = await response.json();
    const task = data?.tasks?.[0];
    if (task?.status_code === 40202) {
      await new Promise((resolve) => setTimeout(resolve, 6000));
      return fetchDataForSeo(endpoint, payload);
    }
    return data;
  });
};

async function dataForSeoKeywords(seedKeywords, locationCode) {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) {
    return [];
  }

  const sanitizedKeywords = sanitizeKeywordList(seedKeywords).slice(0, 700);
  if (!sanitizedKeywords.length) {
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
          location_code: locationCode,
          language_code: "en",
          keywords: sanitizedKeywords
        }
      ])
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DataForSEO error: ${error}`);
  }

  const data = await response.json();
  const task = data?.tasks?.[0];
  if (task && task.status_code && task.status_code !== 20000) {
    throw new Error(`DataForSEO task error: ${task.status_message}`);
  }
  const items = task?.result?.[0]?.items ?? task?.result ?? [];
  return sanitizeKeywordList(items.map((item) => item.keyword));
}

async function dataForSeoMetrics(seedKeywords, locationCode) {
  const sanitizedKeywords = sanitizeKeywordList(seedKeywords);
  if (!sanitizedKeywords.length) {
    return [];
  }

  const limitedKeywords = sanitizedKeywords.slice(0, 100);
  const payload = [
    {
      location_code: locationCode,
      language_code: "en",
      keywords: limitedKeywords,
      sort_by: "relevance"
    }
  ];
  const data = await fetchDataForSeo(
    "keywords_data/google_ads/search_volume/live",
    payload
  );
  const task = data?.tasks?.[0];
  if (task && task.status_code && task.status_code !== 20000) {
    throw new Error(`DataForSEO task error: ${task.status_message}`);
  }
  const items = task?.result?.[0]?.items ?? task?.result ?? [];
  return items
    .map((item) => ({
      keyword: item.keyword,
      searchVolume: item.search_volume ?? 0,
      cpc: item.cpc ?? 0,
      competition:
        item.competition_index ??
        (typeof item.competition === "number" ? item.competition : 0),
      competitionLevel:
        item.competition_level ??
        (typeof item.competition === "string" ? item.competition : "")
    }))
    .filter((item) => item.keyword);
}

function buildClusterTaxonomy(keywords) {
  const l1Map = new Map();
  const l2Map = new Map();
  const l3Map = new Map();

  const assignments = [];

  keywords.forEach((keyword) => {
    const tokens = keyword
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter(Boolean)
      .filter((token) => !stopWords.has(token));
    const l1Key = tokens[0] ?? "general";
    const l2Key = tokens[1] ?? "general";
    const l3Key = tokens.slice(0, 2).join(" ") || l2Key || l1Key;

    const l1Id = `l1-${slugify(l1Key) || "general"}`;
    const l2Id = `l2-${slugify(l1Key) || "general"}-${slugify(l2Key) || "general"}`;
    const l3Id = `l3-${slugify(l1Key) || "general"}-${slugify(l2Key) || "general"}-${slugify(l3Key) || "topic"
      }`;

    if (!l1Map.has(l1Id)) {
      l1Map.set(l1Id, {
        id: l1Id,
        name: l1Key,
        definition: "",
        children: new Set()
      });
    }
    if (!l2Map.has(l2Id)) {
      l2Map.set(l2Id, {
        id: l2Id,
        parentId: l1Id,
        name: l2Key,
        definition: "",
        intentClass: "",
        children: new Set()
      });
    }
    if (!l3Map.has(l3Id)) {
      l3Map.set(l3Id, {
        id: l3Id,
        parentId: l2Id,
        name: l3Key,
        definition: "",
        serpPageType: "",
        mappedUrl: "",
        evidenceRequired: []
      });
    }

    l1Map.get(l1Id).children.add(l2Id);
    l2Map.get(l2Id).children.add(l3Id);

    assignments.push({
      keyword,
      clusterId: l3Id,
      intent: "commercial"
    });
  });

  return {
    taxonomy: {
      L1: Array.from(l1Map.values()).map((item) => ({
        ...item,
        children: Array.from(item.children)
      })),
      L2: Array.from(l2Map.values()).map((item) => ({
        ...item,
        children: Array.from(item.children)
      })),
      L3: Array.from(l3Map.values())
    },
    assignments
  };
}

function flattenTaxonomy(taxonomy) {
  if (!taxonomy) {
    return [];
  }
  const rows = [];
  (taxonomy.L1 ?? []).forEach((item) =>
    rows.push({ level: "L1", ...item })
  );
  (taxonomy.L2 ?? []).forEach((item) =>
    rows.push({ level: "L2", ...item })
  );
  (taxonomy.L3 ?? []).forEach((item) =>
    rows.push({ level: "L3", ...item })
  );
  return rows;
}

function normalizeOutputForExport(type, payload) {
  if (!payload) {
    return [];
  }
  switch (type) {
    case "competitor":
      return payload?.featureFlags?.competitors ?? [];
    case "routing":
      return payload?.routingTable ?? [];
    case "taxonomy":
      return flattenTaxonomy(payload);
    case "keywords":
      return payload?.assignments ?? [];
    case "proof":
      return payload?.proofBlocks ?? [];
    default:
      return payload;
  }
}

function toCsv(rows) {
  const data = Array.isArray(rows) ? rows : [rows];
  if (!data.length) {
    return "";
  }
  const headers = Array.from(
    data.reduce((set, row) => {
      Object.keys(row ?? {}).forEach((key) => set.add(key));
      return set;
    }, new Set())
  );

  const escape = (value) => {
    if (value === null || value === undefined) {
      return "";
    }
    const text =
      typeof value === "string" ? value : JSON.stringify(value, null, 0);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const lines = [headers.join(",")];
  data.forEach((row) => {
    const line = headers.map((key) => escape(row?.[key]));
    lines.push(line.join(","));
  });
  return lines.join("\n");
}

const stage1Columns = [
  "Keyword",
  "Search Volume",
  "CPC",
  "Competition",
  "Intent Stage",
  "Source Type (brand/generic)",
  "Competitor",
  "Competitors Bidding",
  "Cluster",
  "Concern"
];

const stage1ClusterColumns = ["Cluster", "Intent Stage", "Concern", "Score"];

const stage1RowsToCsv = (rows) => {
  if (!rows.length) {
    return stage1Columns.join(",");
  }
  const escape = (value) => {
    if (value === null || value === undefined) {
      return "";
    }
    const text = typeof value === "string" ? value : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = [stage1Columns.join(",")];
  rows.forEach((row) => {
    const line = stage1Columns.map((column) => escape(row[column]));
    lines.push(line.join(","));
  });
  return lines.join("\n");
};

const stage1ClustersToCsv = (clusters) => {
  if (!clusters.length) {
    return stage1ClusterColumns.join(",");
  }
  const escape = (value) => {
    if (value === null || value === undefined) {
      return "";
    }
    const text = typeof value === "string" ? value : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const rows = clusters.map((cluster) => ({
    Cluster: cluster.name ?? "",
    "Intent Stage": cluster.intentStage ?? "",
    Concern: cluster.concern ?? "",
    Score: cluster.score ?? ""
  }));
  const lines = [stage1ClusterColumns.join(",")];
  rows.forEach((row) => {
    const line = stage1ClusterColumns.map((column) => escape(row[column]));
    lines.push(line.join(","));
  });
  return lines.join("\n");
};

const buildStage1Prompt = (payload) => {
  const base = {
    targetUrl: payload.targetUrl,
    competitors: payload.competitors,
    industry: payload.industry,
    audience: payload.audience,
    constraints: payload.constraints,
    initialClusters: payload.initialClusters
  };

  const commonRules = `Return JSON only. Provide 12-25 clusters.
Each cluster must include: name, intentStage (awareness|consideration|decision), concern (optional), score (0-100).
Avoid duplicates. Keep names short and specific. Prefer customer language over internal jargon.
Format: { "clusters": [ { "name": "...", "intentStage": "...", "concern": "...", "score": 0 } ] }`;

  if (payload.marketType === "b2b") {
    return {
      system: "You are a B2B keyword clustering assistant.",
      prompt: `${commonRules}
Follow this B2B intent framing:
- Transactional: pricing/demo/quote/vendor selection
- Commercial investigation: best, reviews, alternatives, comparisons
- Problem-led: operational pain, compliance, workflow bottlenecks
- Procurement/social value: tenders, bid content, evidence packs
- Governance: due diligence, audit trail, risk controls

Cluster naming examples:
- Grant management software
- Corporate giving platform
- Social value reporting
- Due diligence workflow
- Impact dashboard
- Stakeholder voting tool

Input: ${JSON.stringify(base)}`
    };
  }

  return {
    system: "You are a B2C keyword clustering assistant.",
    prompt: `${commonRules}
Follow this B2C intent framing:
- Awareness: concerns, symptoms, routines (e.g., pigmentation causes)
- Consideration: best/top/reviews/comparison
- Decision: buy/price/discount/trial

Cluster naming examples:
- Pigmented skin treatment
- Dark spots correction
- Brightening serums
- Lash growth serum
- Sensitive skin routine

Input: ${JSON.stringify(base)}`
  };
};

const parseListInput = (value) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => item.toString().trim()).filter(Boolean);
  }
  return value
    .split(/[\n,]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
};

const buildFallbackClusters = (input) => {
  const industry = (input.industry ?? "").toString().trim();
  const initial = parseListInput(input.initialClusters);
  const competitorUrls = input.competitors ?? [];
  const targetUrl = input.targetUrl ?? "";

  const brandTerms = extractBrandTerms([targetUrl, ...competitorUrls]);

  const tokenSet = new Set();
  initial.forEach((item) => tokenSet.add(item));
  if (industry) {
    tokenSet.add(industry);
  }

  const addBigrams = (tokens) => {
    for (let i = 0; i < tokens.length - 1; i += 1) {
      tokenSet.add(`${tokens[i]} ${tokens[i + 1]}`);
    }
  };

  [targetUrl, ...competitorUrls].forEach((url) => {
    const tokens = extractKeywordsFromUrl(url).filter(
      (token) => !brandTerms.includes(token)
    );
    tokens.forEach((token) => tokenSet.add(token));
    addBigrams(tokens);
  });

  const clusters = Array.from(tokenSet)
    .filter(Boolean)
    .slice(0, 20)
    .map((name, index) => ({
      id: slugify(name) || `cluster-${index + 1}`,
      name,
      intentStage: "awareness",
      concern: industry,
      score: 60 - index
    }));

  return clusters;
};

const normalizeClusters = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => ({
      id: slugify(item.id ?? item.name ?? ""),
      name: (item.name ?? "").toString().trim(),
      intentStage: item.intentStage ?? "",
      concern: item.concern ?? "",
      score: Number(item.score ?? 0)
    }))
    .filter((item) => item.id && item.name);
};

const collectSeedKeywords = (clusters, industry, audience, input) => {
  const seeds = new Set();
  clusters.forEach((cluster) => {
    seeds.add(cluster.name);
    if (industry) {
      seeds.add(`${cluster.name} ${industry}`);
    }
    if (audience) {
      seeds.add(`${cluster.name} ${audience}`);
    }
  });

  const competitorUrls = input?.competitors ?? [];
  const targetUrl = input?.targetUrl ?? "";
  const brandTerms = extractBrandTerms([targetUrl, ...competitorUrls]);

  [targetUrl, ...competitorUrls].forEach((url) => {
    const tokens = extractKeywordsFromUrl(url).filter(
      (token) => !brandTerms.includes(token)
    );
    tokens.forEach((token) => seeds.add(token));
    for (let i = 0; i < tokens.length - 1; i += 1) {
      seeds.add(`${tokens[i]} ${tokens[i + 1]}`);
    }
  });

  if (industry) {
    seeds.add(`${industry} products`);
    seeds.add(`${industry} routine`);
  }

  return sanitizeKeywordList(Array.from(seeds));
};

const applyExclusions = (keyword, exclusions) => {
  if (!exclusions.length) {
    return true;
  }
  const value = keyword.toLowerCase();
  return !exclusions.some((term) => value.includes(term.toLowerCase()));
};

async function runPipeline(projectId, payload, existingStatus) {
  const status = existingStatus ?? defaultAgentStatus();
  await updateProjectStatus(projectId, status);

  await setStatus(projectId, status, "urlExtractor", "processing");
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
  await setStatus(projectId, status, "urlExtractor", "ready");

  await setStatus(projectId, status, "competitorAnalyzer", "processing");
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
  await saveOutput(projectId, "competitor", competitorOutput);
  await setStatus(projectId, status, "competitorAnalyzer", "ready");

  await setStatus(projectId, status, "dataConnector", "processing");
  const dataConnectorOutput = {
    queryTerms: [],
    searchPatterns: [],
    conversionPaths: [],
    voiceOfCustomer: []
  };
  await setStatus(projectId, status, "dataConnector", "ready");

  await setStatus(projectId, status, "keywordExpander", "processing");
  const seedFamilies = buildSeedFamilies(payload, urlExtractorOutput);
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
  const keywordExpansionOutput = {
    expandedKeywords,
    suggestedQueries: openAiExpansion.suggestedQueries ?? [],
    serpSuggestions: dataForSeoSuggestions
  };
  await saveOutput(projectId, "keywords", keywordExpansionOutput);
  await setStatus(projectId, status, "keywordExpander", "ready");

  await setStatus(projectId, status, "clusteringEngine", "processing");
  const clusteringOutput = buildClusterTaxonomy(expandedKeywords);
  await saveOutput(projectId, "taxonomy", clusteringOutput.taxonomy);
  await saveOutput(projectId, "keywords", clusteringOutput);
  await setStatus(projectId, status, "clusteringEngine", "ready");

  await setStatus(projectId, status, "intentClassifier", "processing");
  await openaiJson(
    `Classify intent for these keywords: ${expandedKeywords
      .slice(0, 50)
      .join(", ")}. Return JSON with { intentTags: string[], serpPageTypes: string[], evidenceRequired: string[] }.`,
    "You are an intent classification engine. Only return JSON."
  );
  await setStatus(projectId, status, "intentClassifier", "ready");

  await setStatus(projectId, status, "userStateRouter", "processing");
  const routerResponse =
    (await openaiJson(
      `Given jobs=${payload?.userStates?.jobs ?? []}, constraints=${payload?.userStates?.constraints ?? []
      }, outcomes=${payload?.userStates?.outcomes ?? []}, propose routing rules. Return JSON with { routingTable: { job, constraint, outcome, pageType, cta }[], proofBlocks: string[] }.`,
      "You are a routing engine. Only return JSON."
    )) ?? {};
  const routerOutput = {
    routingTable: routerResponse.routingTable ?? [],
    pageRequirements: [],
    proofBlocks: routerResponse.proofBlocks ?? []
  };
  await saveOutput(projectId, "routing", routerOutput);
  await saveOutput(projectId, "proof", { proofBlocks: routerOutput.proofBlocks });
  await setStatus(projectId, status, "userStateRouter", "ready");

  return status;
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/projects", async (req, res) => {
  const payload = req.body ?? {};
  if (!payload.name || !payload.domain) {
    return res.status(400).json({ error: "name and domain are required" });
  }
  try {
    const project = await createProject(payload);
    return res.json({ projectId: project.id, status: project.status });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/projects/:id/run", async (req, res) => {
  const projectId = req.params.id;
  const status = await getProjectStatus(projectId);
  if (!status) {
    return res.status(404).json({ error: "Project not found" });
  }

  const payload = req.body ?? {};
  runPipeline(projectId, payload, status).catch((error) => {
    console.error("Pipeline failed", error);
  });

  return res.json({ projectId, status });
});

app.get("/api/projects/:id/stream", async (req, res) => {
  const projectId = req.params.id;
  const status = await getProjectStatus(projectId);
  if (!status) {
    return res.status(404).json({ error: "Project not found" });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  res.write(`data: ${JSON.stringify({ type: "status", status })}\n\n`);

  if (!sseClients.has(projectId)) {
    sseClients.set(projectId, new Set());
  }
  sseClients.get(projectId).add(res);

  const keepAlive = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: "keepalive" })}\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    const clients = sseClients.get(projectId);
    if (clients) {
      clients.delete(res);
      if (!clients.size) {
        sseClients.delete(projectId);
      }
    }
  });
});

app.get("/api/projects/:id/status", async (req, res) => {
  const status = await getProjectStatus(req.params.id);
  if (!status) {
    return res.status(404).json({ error: "Project not found" });
  }
  return res.json({ projectId: req.params.id, status });
});

app.get("/api/projects/:id/outputs/:type", async (req, res) => {
  const outputType = req.params.type;
  if (!OUTPUT_TYPES.has(outputType)) {
    return res.status(400).json({ error: "Invalid output type" });
  }

  const payload = await getOutput(req.params.id, outputType);
  if (!payload) {
    return res.status(404).json({ error: "Output not found" });
  }

  const format = (req.query.format ?? "json").toString().toLowerCase();
  if (format === "csv") {
    const rows = normalizeOutputForExport(outputType, payload);
    const csv = toCsv(rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${outputType}.csv"`
    );
    return res.send(csv);
  }

  return res.json({ projectId: req.params.id, type: outputType, payload });
});

app.post("/api/stage1/projects", async (req, res) => {
  const payload = req.body ?? {};
  if (!payload.country) {
    payload.country = "UK";
  }
  if (payload.minVolumeEnabled === undefined) {
    payload.minVolumeEnabled = true;
  }
  if (payload.clusterLimitMode === undefined) {
    payload.clusterLimitMode = "top";
  }
  if (payload.maxClusters === undefined) {
    payload.maxClusters = 12;
  }
  if (payload.maxRowsPerCluster === undefined) {
    payload.maxRowsPerCluster = 50;
  }
  if (!payload.targetUrl) {
    return res.status(400).json({ error: "targetUrl is required" });
  }

  const project = await createProject({
    name: payload.targetUrl,
    domain: payload.targetUrl
  });
  await saveOutput(project.id, "stage1_input", payload);
  return res.json({ projectId: project.id });
});

app.post("/api/stage1/projects/:id/clusters", async (req, res) => {
  const projectId = req.params.id;
  const input = await getOutput(projectId, "stage1_input");
  if (!input) {
    return res.status(404).json({ error: "Stage 1 input not found" });
  }

  const { system, prompt } = buildStage1Prompt(input);
  const response = await openaiJson(prompt, system);
  const clusters = normalizeClusters(response?.clusters ?? response ?? []);
  const fallbackClusters = normalizeClusters(
    parseListInput(input.initialClusters).map((name) => ({
      name,
      intentStage: "awareness",
      concern: input.industry ?? "",
      score: 50
    }))
  );
  const finalClusters =
    clusters.length || fallbackClusters.length
      ? clusters.length
        ? clusters
        : fallbackClusters
      : buildFallbackClusters(input);
  await saveOutput(projectId, "stage1_clusters", finalClusters);
  return res.json({ projectId, clusters: finalClusters });
});

app.get("/api/stage1/projects/:id/clusters", async (req, res) => {
  const projectId = req.params.id;
  const clusters = await getOutput(projectId, "stage1_clusters");
  if (!clusters) {
    return res.status(404).json({ error: "Stage 1 clusters not found" });
  }

  const format = (req.query.format ?? "json").toString().toLowerCase();
  if (format === "csv") {
    const csv = stage1ClustersToCsv(clusters);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="stage1-clusters.csv"'
    );
    return res.send(csv);
  }

  return res.json({ projectId, clusters });
});

app.post("/api/stage1/projects/:id/selection", async (req, res) => {
  const projectId = req.params.id;
  const selection = req.body?.selectedIds ?? [];
  await saveOutput(projectId, "stage1_selected", selection);
  return res.json({ projectId, selectedIds: selection });
});

app.get("/api/dataforseo/test", async (req, res) => {
  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
    return res
      .status(400)
      .json({ status: "error", message: "Missing DataForSEO credentials." });
  }
  try {
    const country = req.query?.country?.toString();
    const result = await dataForSeoTest(country);
    if (result.statusCode && result.statusCode !== 20000) {
      return res.status(502).json({
        status: "error",
        message: result.statusMessage || "DataForSEO task error.",
        statusCode: result.statusCode,
        itemsCount: result.itemsCount
      });
    }
    if (result.itemsCount === 0) {
      return res.json({
        status: "empty",
        message: "DataForSEO returned zero items. Metrics will be blank.",
        statusCode: result.statusCode,
        itemsCount: result.itemsCount
      });
    }
    return res.json({
      status: "ok",
      message: "DataForSEO returned keyword metrics.",
      statusCode: result.statusCode,
      itemsCount: result.itemsCount
    });
  } catch (error) {
    return res.status(502).json({
      status: "error",
      message: error instanceof Error ? error.message : "DataForSEO test failed."
    });
  }
});

app.get("/api/dataforseo/errors", async (_req, res) => {
  try {
    const payload = [
      {
        limit: 100,
        offset: 0,
        sort: "desc"
      }
    ];
    const data = await fetchDataForSeo("keywords_data/errors", payload);
    return res.json(data);
  } catch (error) {
    return res.status(502).json({
      status: "error",
      message: error instanceof Error ? error.message : "DataForSEO errors failed."
    });
  }
});

app.get("/api/dataforseo/id_list", async (_req, res) => {
  try {
    const payload = [
      {
        limit: 100,
        offset: 0
      }
    ];
    const data = await fetchDataForSeo("keywords_data/id_list", payload);
    return res.json(data);
  } catch (error) {
    return res.status(502).json({
      status: "error",
      message: error instanceof Error ? error.message : "DataForSEO id_list failed."
    });
  }
});

app.get("/api/dataforseo/sanity", async (_req, res) => {
  try {
    const metrics = await dataForSeoMetrics(["buy laptop"], locationCodeMap.US);
    if (!metrics.length) {
      return res.json({
        status: "empty",
        message: "Sanity check returned zero items for 'buy laptop' (US).",
        itemsCount: 0
      });
    }
    return res.json({
      status: "ok",
      message: "Sanity check returned metrics for 'buy laptop' (US).",
      itemsCount: metrics.length
    });
  } catch (error) {
    return res.status(502).json({
      status: "error",
      message: error instanceof Error ? error.message : "Sanity check failed."
    });
  }
});

app.get("/api/dataforseo/sanity_raw", async (_req, res) => {
  try {
    const metrics = await dataForSeoMetrics(["buy laptop"], locationCodeMap.US);
    const payload = [
      {
        location_code: locationCodeMap.US,
        language_code: "en",
        keywords: ["buy laptop"],
        sort_by: "relevance"
      }
    ];
    const raw = await fetchDataForSeo(
      "keywords_data/google_ads/search_volume/live",
      payload
    );
    const rawTask = raw?.tasks?.[0];
    const rawResult = rawTask?.result ?? [];
    return res.json({
      count: metrics.length,
      metrics,
      rawCount: Array.isArray(rawResult) ? rawResult.length : 0,
      rawSample: Array.isArray(rawResult) ? rawResult[0] : null
    });
  } catch (error) {
    return res.status(502).json({
      status: "error",
      message: error instanceof Error ? error.message : "Sanity check failed."
    });
  }
});

app.get("/api/dataforseo/sanity_response", async (_req, res) => {
  try {
    const payload = [
      {
        location_code: locationCodeMap.US,
        language_code: "en",
        keywords: ["buy laptop"],
        sort_by: "relevance"
      }
    ];
    const data = await fetchDataForSeo(
      "keywords_data/google_ads/search_volume/live",
      payload
    );
    return res.json(data);
  } catch (error) {
    return res.status(502).json({
      status: "error",
      message:
        error instanceof Error ? error.message : "Sanity response failed."
    });
  }
});

app.post("/api/stage1/projects/:id/keywords", async (req, res) => {
  const projectId = req.params.id;
  const input = await getOutput(projectId, "stage1_input");
  const clusters = await getOutput(projectId, "stage1_clusters");
  if (!input || !clusters) {
    return res.status(404).json({ error: "Stage 1 input/clusters not found" });
  }

  const inputOverrides = req.body?.inputOverrides ?? {};
  const effectiveInput = { ...input, ...inputOverrides };
  if (!effectiveInput.country) {
    effectiveInput.country = "UK";
  }
  if (effectiveInput.minVolumeEnabled === undefined) {
    effectiveInput.minVolumeEnabled = true;
  }
  if (effectiveInput.clusterLimitMode === undefined) {
    effectiveInput.clusterLimitMode = "top";
  }
  if (effectiveInput.maxClusters === undefined) {
    effectiveInput.maxClusters = 12;
  }
  if (effectiveInput.maxRowsPerCluster === undefined) {
    effectiveInput.maxRowsPerCluster = 50;
  }
  if (Object.keys(inputOverrides).length) {
    await saveOutput(projectId, "stage1_input", effectiveInput);
  }

  const selectedIds =
    req.body?.selectedIds ??
    (await getOutput(projectId, "stage1_selected")) ??
    [];
  const selectedClusters = clusters.filter((cluster) =>
    selectedIds.length ? selectedIds.includes(cluster.id) : true
  );

  const limitedClusters = limitClusters(
    selectedClusters,
    Number(effectiveInput.maxClusters ?? 0),
    effectiveInput.clusterLimitMode ?? "none"
  );

  const industry = effectiveInput.industry ?? "";
  const audience = effectiveInput.audience ?? "";
  const exclusions = parseListInput(effectiveInput.constraints);

  const seedKeywords = collectSeedKeywords(
    limitedClusters,
    industry,
    audience,
    effectiveInput
  );
  const limitedSeeds = seedKeywords.slice(0, 20);
  const locationCode = getLocationCode(effectiveInput.country);
  const minVolumeEnabled = effectiveInput.minVolumeEnabled ?? true;
  const minVolume = 10;
  let metrics = [];
  let dataForSeoStatus = { status: "ok", message: "" };
  let keywordIdeas = [];
  try {
    keywordIdeas = await dataForSeoKeywords(limitedSeeds, locationCode);
    const metricSeeds = keywordIdeas.length ? keywordIdeas : limitedSeeds;
    metrics = await dataForSeoMetrics(metricSeeds, locationCode);
  } catch (error) {
    console.warn("DataForSEO metrics failed:", error.message);
    dataForSeoStatus = {
      status: "error",
      message: error instanceof Error ? error.message : "DataForSEO error."
    };
  }
  if (metrics.length === 0 && dataForSeoStatus.status !== "error") {
    dataForSeoStatus = {
      status: "empty",
      message: keywordIdeas.length
        ? "DataForSEO returned keywords but no metrics. Check the metrics endpoint."
        : "DataForSEO returned zero items. Metrics will be blank."
    };
  }

  let filteredMetrics = metrics;
  if (minVolumeEnabled) {
    filteredMetrics = metrics.filter(
      (item) => Number(item.searchVolume ?? 0) >= minVolume
    );
    if (metrics.length > 0 && filteredMetrics.length === 0) {
      dataForSeoStatus = {
        status: "empty",
        message:
          "All keyword metrics were below volume 10. Disable the filter to include them."
      };
    }
  }

  const competitorBrands = extractBrandTerms(effectiveInput.competitors ?? []);
  const targetBrands = extractBrandTerms([effectiveInput.targetUrl]);
  const brandTerms = [...new Set([...targetBrands, ...competitorBrands])];

  let rows = filteredMetrics
    .filter((item) => applyExclusions(item.keyword, exclusions))
    .map((item) => {
      const matchedCluster =
        guessClusterForKeyword(item.keyword, limitedClusters) ??
        limitedClusters[0];
      const intentStage = matchedCluster?.intentStage
        ? matchedCluster.intentStage
        : inferIntentStage(item.keyword);
      const sourceType = inferSourceType(item.keyword, brandTerms);
      const competitor = findCompetitorMatch(item.keyword, competitorBrands);
      return {
        Keyword: item.keyword,
        "Search Volume": item.searchVolume ?? "",
        CPC: item.cpc ?? "",
        Competition: item.competition ?? "",
        "Intent Stage": intentStage,
        "Source Type (brand/generic)": sourceType,
        Competitor: competitor,
        "Competitors Bidding": "",
        Cluster: matchedCluster?.name ?? "",
        Concern: matchedCluster?.concern || industry
      };
    });

  if (rows.length === 0) {
    dataForSeoStatus = {
      status: "empty",
      message: dataForSeoStatus.message || "DataForSEO returned zero items."
    };
  }

  rows.sort(
    (a, b) =>
      Number(b["Search Volume"] ?? 0) - Number(a["Search Volume"] ?? 0)
  );

  const maxRowsPerCluster = Number(effectiveInput.maxRowsPerCluster ?? 0);
  if (maxRowsPerCluster > 0) {
    const clusterCounts = new Map();
    rows = rows.filter((row) => {
      const key = row.Cluster || "General";
      const current = clusterCounts.get(key) ?? 0;
      if (current >= maxRowsPerCluster) {
        return false;
      }
      clusterCounts.set(key, current + 1);
      return true;
    });
  }

  if (rows.length === 0) {
    dataForSeoStatus = {
      status: "empty",
      message:
        dataForSeoStatus.message ||
        "All rows were filtered by cluster limits or exclusions."
    };
  }

  await saveOutput(projectId, "stage1_keywords", rows);
  return res.json({ projectId, rows, dataForSeo: dataForSeoStatus });
});

app.get("/api/stage1/projects/:id/keywords", async (req, res) => {
  const projectId = req.params.id;
  const rows = await getOutput(projectId, "stage1_keywords");
  if (!rows) {
    return res.status(404).json({ error: "Stage 1 keywords not found" });
  }

  const format = (req.query.format ?? "json").toString().toLowerCase();
  if (format === "csv") {
    const csv = stage1RowsToCsv(rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="stage1-keywords.csv"'
    );
    return res.send(csv);
  }

  return res.json({ projectId, rows });
});

const distPath = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});
