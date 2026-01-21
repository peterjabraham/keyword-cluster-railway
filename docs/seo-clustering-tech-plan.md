# Technical Development Plan: SEO Clustering & User-State Router

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE PAGES (Frontend)                          │
│   Single-page app with step-based wizard UI (not tabs)                      │
│   Progressive disclosure: show outputs as they complete                      │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR WORKER                                     │
│   Receives input payload → spawns parallel agents → aggregates results       │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│  URL Extractor │       │  Competitor    │       │  Data Source  │
│  Agent         │       │  Analyzer      │       │  Connector    │
│                │       │  Agent         │       │  Agent        │
└───────┬───────┘       └───────┬───────┘       └───────┬───────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PROCESSING PIPELINE WORKERS                             │
│   Keyword Expansion → Clustering → Intent Classification → Routing          │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE D1 + KV                                      │
│   D1: Structured outputs (clusters, routing tables)                          │
│   KV: Cache layers, intermediate results, session state                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Design Principles

### 1. Agent-Based Architecture (No Tabs)
Replace traditional tab UI with **skill-based agents** that process independently and stream results as ready.

### 2. Parallel Execution
Tasks without dependencies run simultaneously using Cloudflare Workers' concurrent execution model.

### 3. Task Chaining via Queues
Use Cloudflare Queues to chain dependent tasks without blocking.

### 4. Progressive Output
Results display as each agent completes—no waiting for full pipeline.

---

## Agent Definitions

### Agent 1: URL Extractor
**Trigger:** Target domain URL submitted  
**Dependencies:** None  
**Runs in parallel with:** Competitor Analyzer, Data Source Connector

```typescript
// worker: url-extractor.ts
interface URLExtractorInput {
  domain: string;
  moneyPages?: string[];
  depth?: number; // crawl depth limit
}

interface URLExtractorOutput {
  navigation: NavItem[];
  pageThemes: PageTheme[];
  h1h2Patterns: HeadingPattern[];
  proofPages: string[];
  useCasePages: string[];
}

// Extracts:
// - Navigation structure
// - H1/H2 patterns across pages
// - Module/use-case pages
// - Proof/social-proof pages
// - Current page type inventory
```

### Agent 2: Competitor Analyzer
**Trigger:** Competitor domains provided  
**Dependencies:** None  
**Runs in parallel with:** URL Extractor, Data Source Connector

```typescript
// worker: competitor-analyzer.ts
interface CompetitorInput {
  competitorDomains: string[];
  keyPages?: string[]; // optional specific pages
}

interface CompetitorOutput {
  featureFlags: FeatureFlagMatrix;
  pageTypeInventory: PageType[];
  missingClusters: string[]; // gaps vs target
  proofPatterns: ProofPattern[];
}

// Feature flags detected:
// - Pricing/Demo pages
// - Security/Compliance pages
// - Integration pages
// - Use case pages
// - Industry pages
// - Persona pages
// - Comparison pages
// - ROI/Calculator pages
// - Implementation guides
```

### Agent 3: Data Source Connector
**Trigger:** Data sources configured (GSC, GA4, Ads, etc.)  
**Dependencies:** None  
**Runs in parallel with:** URL Extractor, Competitor Analyzer

```typescript
// worker: data-connector.ts
interface DataSourceInput {
  sources: {
    gsc?: GSCConfig;
    ga4?: GA4Config;
    ads?: AdsConfig;
    crm?: CRMConfig;
    siteSearch?: SiteSearchConfig;
    reviews?: ReviewsConfig;
  };
}

interface DataSourceOutput {
  queryTerms: QueryTerm[];
  searchPatterns: SearchPattern[];
  conversionPaths: ConversionPath[];
  voiceOfCustomer: VOCInsight[];
}
```

### Agent 4: Keyword Expander
**Trigger:** URL Extractor + Competitor Analyzer complete  
**Dependencies:** PageThemes from Agent 1, FeatureFlags from Agent 2

```typescript
// worker: keyword-expander.ts
interface KeywordExpanderInput {
  seedFamilies: SeedFamily[]; // from page themes
  competitorGaps: string[];
  dataSourceTerms?: QueryTerm[];
}

interface KeywordExpanderOutput {
  expandedKeywords: ExpandedKeyword[];
  suggestedQueries: string[];
  serpSuggestions: SERPSuggestion[];
}
```

### Agent 5: Clustering Engine
**Trigger:** Keyword Expander complete  
**Dependencies:** Expanded keyword universe

```typescript
// worker: clustering-engine.ts
interface ClusteringInput {
  keywords: ExpandedKeyword[];
  existingTaxonomy?: ClusterTaxonomy;
}

interface ClusteringOutput {
  taxonomy: {
    L1: ClusterL1[];
    L2: ClusterL2[];
    L3: ClusterL3[];
  };
  assignments: KeywordClusterAssignment[];
}
```

### Agent 6: Intent Classifier
**Trigger:** Clustering Engine complete  
**Dependencies:** Cluster taxonomy

```typescript
// worker: intent-classifier.ts
interface IntentInput {
  clusters: ClusterTaxonomy;
  keywords: KeywordClusterAssignment[];
}

interface IntentOutput {
  intentTags: IntentTag[]; // informational, commercial, transactional, navigational
  serpPageTypes: SERPPageType[];
  evidenceRequired: EvidenceRequirement[];
}
```

### Agent 7: User-State Router
**Trigger:** Intent Classifier complete  
**Dependencies:** Intent classifications + User state inputs

```typescript
// worker: user-state-router.ts
interface RouterInput {
  clusters: ClusterTaxonomy;
  intents: IntentTag[];
  userStates: {
    jobs: Job[]; // Choose, Buy, Use, Fix, Prove
    constraints: Constraint[]; // Risk, Time, Budget, Compatibility, Authority
    outcomes: Outcome[]; // Growth, Time saved, Risk reduced, Quality, Impact
  };
}

interface RouterOutput {
  routingTable: RoutingRule[];
  pageRequirements: PageRequirement[];
  proofBlocks: ProofBlock[];
}
```

---

## Cloudflare Infrastructure

### Workers (7 agents + 1 orchestrator)
```
/workers
├── orchestrator.ts          # Job coordinator
├── url-extractor.ts         # Agent 1
├── competitor-analyzer.ts   # Agent 2
├── data-connector.ts        # Agent 3
├── keyword-expander.ts      # Agent 4
├── clustering-engine.ts     # Agent 5
├── intent-classifier.ts     # Agent 6
└── user-state-router.ts     # Agent 7
```

### Queue Configuration
```toml
# wrangler.toml
[[queues.producers]]
queue = "extraction-complete"
binding = "EXTRACTION_QUEUE"

[[queues.consumers]]
queue = "extraction-complete"
script_name = "keyword-expander"

[[queues.producers]]
queue = "expansion-complete"
binding = "EXPANSION_QUEUE"

[[queues.consumers]]
queue = "expansion-complete"
script_name = "clustering-engine"

[[queues.producers]]
queue = "clustering-complete"
binding = "CLUSTERING_QUEUE"

[[queues.consumers]]
queue = "clustering-complete"
script_name = "intent-classifier"

[[queues.producers]]
queue = "intent-complete"
binding = "INTENT_QUEUE"

[[queues.consumers]]
queue = "intent-complete"
script_name = "user-state-router"
```

### D1 Database Schema
```sql
-- Projects table
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'pending'
);

-- Cluster taxonomy
CREATE TABLE clusters (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  level INTEGER NOT NULL, -- 1, 2, or 3
  parent_id TEXT REFERENCES clusters(id),
  name TEXT NOT NULL,
  definition TEXT,
  intent_class TEXT,
  serp_page_type TEXT,
  mapped_url TEXT,
  evidence_required TEXT
);

-- Keywords
CREATE TABLE keywords (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  keyword TEXT NOT NULL,
  cluster_id TEXT REFERENCES clusters(id),
  intent TEXT,
  persona TEXT,
  industry TEXT,
  best_url TEXT,
  source TEXT,
  volume INTEGER,
  difficulty REAL
);

-- Routing rules
CREATE TABLE routing_rules (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  job TEXT NOT NULL,
  constraint_type TEXT NOT NULL,
  outcome TEXT NOT NULL,
  page_type TEXT NOT NULL,
  url TEXT,
  proof_block TEXT,
  cta TEXT
);

-- Competitor feature flags
CREATE TABLE competitor_features (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  competitor_domain TEXT NOT NULL,
  feature_type TEXT NOT NULL,
  has_page BOOLEAN DEFAULT FALSE,
  page_url TEXT,
  notes TEXT
);

-- Proof blocks
CREATE TABLE proof_blocks (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  uncertainty_type TEXT NOT NULL, -- fit, risk, value, effort, legitimacy
  skeptic_question TEXT NOT NULL,
  proof_elements TEXT,
  artifact_to_build TEXT,
  placement TEXT
);
```

### KV Namespaces
```toml
# wrangler.toml
[[kv_namespaces]]
binding = "SESSION_CACHE"
id = "xxx"

[[kv_namespaces]]
binding = "CRAWL_CACHE"
id = "xxx"

[[kv_namespaces]]
binding = "SERP_CACHE"
id = "xxx"
```

---

## Execution Flow

### Phase 1: Parallel Extraction (No Dependencies)
```
User submits project config
           │
           ▼
    ┌──────┴──────┐
    │ Orchestrator │
    └──────┬──────┘
           │
    ┌──────┼──────┬──────────────┐
    │      │      │              │
    ▼      ▼      ▼              ▼
Agent 1  Agent 2  Agent 3    (wait)
   │        │        │
   └────────┼────────┘
            │
            ▼
    Results merged in KV
```

### Phase 2: Sequential Processing (Chained via Queues)
```
Merged extraction results
           │
           ▼
    Agent 4: Keyword Expansion
           │
           │ (Queue: expansion-complete)
           ▼
    Agent 5: Clustering
           │
           │ (Queue: clustering-complete)
           ▼
    Agent 6: Intent Classification
           │
           │ (Queue: intent-complete)
           ▼
    Agent 7: User-State Routing
           │
           ▼
    Final outputs to D1
```

---

## Frontend Architecture (Cloudflare Pages)

### No-Tab Design: Step Wizard with Live Updates

```
┌─────────────────────────────────────────────────────────────────┐
│  SEO Clustering Engine                                    [?]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ STEP 1: Project Context                           [Done] │   │
│  │ Channel: SaaS Landing Pages | Motion: Enterprise        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ STEP 2: URLs & Pages                              [Done] │   │
│  │ Target: acme.com | 12 money pages | 3 competitors       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ STEP 3: Audience & Roles                          [Done] │   │
│  │ Buyer: VP Eng | Champion: DevOps Lead | 2 verticals     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ STEP 4: Constraints & Proof                    [Current] │   │
│  │ ┌───────────────────────────────────────────────────┐   │   │
│  │ │ Excluded terms: [competitor-name]                 │   │   │
│  │ │ Must-haves: [SOC2, ISO27001]                      │   │   │
│  │ │ Proof assets: ☑ Case studies ☑ ROI calc ☐ Demo   │   │   │
│  │ └───────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ STEP 5: Data Sources                            [Locked] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ STEP 6: User State Router                       [Locked] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                                         [← Back] [Continue →]   │
└─────────────────────────────────────────────────────────────────┘
```

### Live Output Panel (Shows As Agents Complete)
```
┌─────────────────────────────────────────────────────────────────┐
│  OUTPUTS                                              [Export]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ◉ Competitor Feature Matrix              [Ready] [View] [CSV]  │
│    └─ 3 competitors analyzed, 4 missing page types found        │
│                                                                 │
│  ◉ User-State Routing Table               [Ready] [View] [CSV]  │
│    └─ 15 routing rules generated                                │
│                                                                 │
│  ◐ Cluster Taxonomy                    [Processing 67%] [View]  │
│    └─ L1: 8 clusters | L2: 24 clusters | L3: pending           │
│                                                                 │
│  ○ Keyword List                              [Waiting on L3]    │
│                                                                 │
│  ○ Evidence Blocks                           [Waiting on L3]    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Skills Architecture

Create modular skills that agents reference for specialized tasks.

### Skill: page-type-detector
```
/skills/page-type-detector/
├── SKILL.md
├── scripts/
│   ├── classify_page.py
│   └── extract_signals.py
└── references/
    └── page_type_taxonomy.md
```

**SKILL.md frontmatter:**
```yaml
---
name: page-type-detector
description: Classify web pages into SEO-relevant categories (pricing, demo, security, integration, use-case, industry, persona, comparison, ROI, implementation). Triggers on URL analysis, competitor audits, or page inventory tasks.
---
```

### Skill: intent-classifier
```
/skills/intent-classifier/
├── SKILL.md
├── scripts/
│   └── classify_intent.py
└── references/
    ├── intent_taxonomy.md
    └── serp_patterns.md
```

### Skill: proof-block-generator
```
/skills/proof-block-generator/
├── SKILL.md
├── scripts/
│   └── generate_blocks.py
└── references/
    ├── uncertainty_types.md
    └── proof_patterns.md
```

### Skill: cluster-taxonomy-builder
```
/skills/cluster-taxonomy-builder/
├── SKILL.md
├── scripts/
│   ├── build_taxonomy.py
│   └── validate_clusters.py
└── references/
    ├── taxonomy_structure.md
    └── naming_conventions.md
```

---

## API Endpoints

### Orchestrator Routes
```typescript
// POST /api/projects
// Create new project, returns project_id

// POST /api/projects/:id/run
// Trigger full pipeline execution

// GET /api/projects/:id/status
// Returns status of all agents

// GET /api/projects/:id/outputs/:type
// Returns specific output (clusters, keywords, routing, etc.)

// WebSocket /api/projects/:id/stream
// Real-time updates as agents complete
```

### Agent Communication
```typescript
// Internal: Worker-to-Worker via Service Bindings
// Agents communicate through Cloudflare Service Bindings for zero-latency calls

// wrangler.toml
[[services]]
binding = "URL_EXTRACTOR"
service = "url-extractor"

[[services]]
binding = "COMPETITOR_ANALYZER"  
service = "competitor-analyzer"
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INPUT PAYLOAD                                   │
│                                                                             │
│  {                                                                          │
│    projectContext: { channel, conversion, metric, motion, dealSize },       │
│    urls: { targetDomain, moneyPages, competitors },                         │
│    audience: { buyer, champion, economicBuyer, verticals },                 │
│    constraints: { exclude, mustHave, proofAssets },                         │
│    dataSources: { gsc, ga4, ads, crm },                                     │
│    userStates: { jobs, constraints, outcomes }                              │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PARALLEL EXTRACTION PHASE                            │
│                                                                             │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│   │ URL Extractor│    │ Competitor   │    │ Data Source  │                  │
│   │              │    │ Analyzer     │    │ Connector    │                  │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│          │                   │                   │                          │
│          ▼                   ▼                   ▼                          │
│   pageThemes          featureFlags         queryTerms                       │
│   h1h2Patterns        missingClusters      searchPatterns                   │
│   proofPages          proofPatterns        vocInsights                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SEQUENTIAL PROCESSING PHASE                           │
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────┐     │
│   │ Keyword Expander                                                  │     │
│   │ IN: seedFamilies + competitorGaps + dataSourceTerms              │     │
│   │ OUT: expandedKeywords + serpSuggestions                           │     │
│   └───────────────────────────────┬──────────────────────────────────┘     │
│                                   ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────┐     │
│   │ Clustering Engine                                                 │     │
│   │ IN: expandedKeywords                                              │     │
│   │ OUT: taxonomy (L1/L2/L3) + clusterAssignments                     │     │
│   └───────────────────────────────┬──────────────────────────────────┘     │
│                                   ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────┐     │
│   │ Intent Classifier                                                 │     │
│   │ IN: clusters + keywords                                           │     │
│   │ OUT: intentTags + serpPageTypes + evidenceRequired                │     │
│   └───────────────────────────────┬──────────────────────────────────┘     │
│                                   ▼                                         │
│   ┌──────────────────────────────────────────────────────────────────┐     │
│   │ User-State Router                                                 │     │
│   │ IN: clusters + intents + userStates                               │     │
│   │ OUT: routingTable + pageRequirements + proofBlocks                │     │
│   └──────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OUTPUT PAYLOAD                                  │
│                                                                             │
│  {                                                                          │
│    competitorMatrix: FeatureFlagMatrix,     // Output 1                     │
│    routingTable: RoutingRule[],             // Output 2                     │
│    clusterTaxonomy: ClusterTaxonomy,        // Output 3                     │
│    keywordList: KeywordAssignment[],        // Output 4                     │
│    proofBlocks: ProofBlock[]                // Output 5                     │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Set up Cloudflare Pages project
- [ ] Configure D1 database with schema
- [ ] Set up KV namespaces
- [ ] Create orchestrator worker
- [ ] Build basic frontend wizard UI

### Phase 2: Extraction Agents (Week 3-4)
- [ ] Implement URL Extractor agent
- [ ] Implement Competitor Analyzer agent
- [ ] Implement Data Source Connector agent
- [ ] Test parallel execution
- [ ] Build merge logic for extraction results

### Phase 3: Processing Pipeline (Week 5-6)
- [ ] Implement Keyword Expander agent
- [ ] Implement Clustering Engine agent
- [ ] Implement Intent Classifier agent
- [ ] Implement User-State Router agent
- [ ] Configure Queues for task chaining

### Phase 4: Skills & Polish (Week 7-8)
- [ ] Create page-type-detector skill
- [ ] Create intent-classifier skill
- [ ] Create proof-block-generator skill
- [ ] Create cluster-taxonomy-builder skill
- [ ] Build export functionality (CSV, JSON)
- [ ] Add WebSocket real-time updates

### Phase 5: Testing & Launch (Week 9-10)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Error handling & retry logic
- [ ] Documentation
- [ ] Soft launch with test users

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Frontend framework | React (via Vite) | Fast builds, good Cloudflare Pages support |
| State management | Zustand | Lightweight, no boilerplate |
| Styling | Tailwind CSS | Rapid iteration, small bundle |
| Real-time updates | WebSocket via Durable Objects | Persistent connections for live status |
| Task queue | Cloudflare Queues | Native integration, automatic retries |
| Database | D1 | Edge-native, zero config |
| Cache | KV | Fast reads for intermediate results |
| Worker communication | Service Bindings | Zero-latency internal calls |

---

## Cost Estimation (Cloudflare)

| Resource | Free Tier | Paid Estimate |
|----------|-----------|---------------|
| Workers requests | 100k/day | $0.50/million |
| D1 reads | 5M/month | $0.001/million |
| D1 writes | 100k/month | $1.00/million |
| KV reads | 100k/day | $0.50/million |
| Queues | 1M/month | $0.40/million |
| Pages | Unlimited | Free |

**Estimated monthly cost for moderate usage: $5-15/month**

---

## Security Considerations

1. **API Authentication**: JWT tokens for user sessions
2. **Data isolation**: Project IDs scoped to user accounts
3. **Rate limiting**: Per-user request limits via Workers
4. **Input validation**: Zod schemas on all inputs
5. **Secrets**: Cloudflare Secrets for API keys (GSC, GA4, etc.)

---

## Monitoring & Observability

1. **Cloudflare Analytics**: Built-in request/error metrics
2. **Custom logging**: Workers Logpush to external service
3. **Health checks**: Cron triggers for agent health
4. **Alerts**: Webhook notifications on pipeline failures

---

## File Structure

```
/seo-clustering-engine
├── /frontend                    # Cloudflare Pages
│   ├── /src
│   │   ├── /components
│   │   │   ├── StepWizard.tsx
│   │   │   ├── OutputPanel.tsx
│   │   │   ├── ProjectContext.tsx
│   │   │   ├── URLConfig.tsx
│   │   │   ├── AudienceConfig.tsx
│   │   │   ├── ConstraintsConfig.tsx
│   │   │   ├── DataSourceConfig.tsx
│   │   │   └── UserStateConfig.tsx
│   │   ├── /stores
│   │   │   └── projectStore.ts
│   │   ├── /hooks
│   │   │   ├── useWebSocket.ts
│   │   │   └── useAgentStatus.ts
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── /workers                      # Cloudflare Workers
│   ├── orchestrator.ts
│   ├── url-extractor.ts
│   ├── competitor-analyzer.ts
│   ├── data-connector.ts
│   ├── keyword-expander.ts
│   ├── clustering-engine.ts
│   ├── intent-classifier.ts
│   └── user-state-router.ts
│
├── /skills                       # Reusable agent skills
│   ├── /page-type-detector
│   │   ├── SKILL.md
│   │   ├── /scripts
│   │   └── /references
│   ├── /intent-classifier
│   │   ├── SKILL.md
│   │   ├── /scripts
│   │   └── /references
│   ├── /proof-block-generator
│   │   ├── SKILL.md
│   │   ├── /scripts
│   │   └── /references
│   └── /cluster-taxonomy-builder
│       ├── SKILL.md
│       ├── /scripts
│       └── /references
│
├── /shared                       # Shared types and utilities
│   ├── types.ts
│   ├── schemas.ts
│   └── utils.ts
│
├── /migrations                   # D1 database migrations
│   └── 001_initial.sql
│
├── wrangler.toml                 # Cloudflare config
└── package.json
```

---

## Output Schemas

### 1. Competitor Feature Matrix
```typescript
interface FeatureFlagMatrix {
  competitors: {
    domain: string;
    features: {
      pricing: boolean;
      demo: boolean;
      security: boolean;
      integrations: boolean;
      useCases: boolean;
      industries: boolean;
      personas: boolean;
      comparisons: boolean;
      roi: boolean;
      implementation: boolean;
    };
    urls: Record<string, string>;
  }[];
  gaps: string[]; // Missing from target
}
```

### 2. User-State Routing Table
```typescript
interface RoutingRule {
  job: 'Choose' | 'Buy' | 'Use' | 'Fix' | 'Prove';
  constraint: 'Risk' | 'Time' | 'Budget' | 'Compatibility' | 'Authority';
  outcome: 'Growth' | 'TimeSaved' | 'RiskReduced' | 'Quality' | 'Impact';
  recommendedPageType: string;
  url: string;
  aboveFoldProof: string[];
  cta: string;
}
```

### 3. Cluster Taxonomy
```typescript
interface ClusterTaxonomy {
  L1: {
    id: string;
    name: string;
    definition: string;
    children: string[]; // L2 ids
  }[];
  L2: {
    id: string;
    parentId: string;
    name: string;
    definition: string;
    intentClass: string;
    children: string[]; // L3 ids
  }[];
  L3: {
    id: string;
    parentId: string;
    name: string;
    definition: string;
    serpPageType: string;
    mappedUrl: string;
    evidenceRequired: string[];
  }[];
}
```

### 4. Keyword List
```typescript
interface KeywordAssignment {
  keyword: string;
  clusterId: string;
  clusterPath: string; // L1 > L2 > L3
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  persona: string;
  industry: string;
  bestLandingUrl: string;
  source: string;
  metrics?: {
    volume?: number;
    difficulty?: number;
    cpc?: number;
  };
}
```

### 5. Evidence Blocks
```typescript
interface ProofBlock {
  uncertaintyType: 'Fit' | 'Risk' | 'Value' | 'Effort' | 'Legitimacy';
  skepticQuestion: string;
  proofElements: string[];
  artifactToBuild: string;
  placement: string; // Where on page
}
```

---

## Next Steps

1. **Validate architecture** with stakeholder review
2. **Set up Cloudflare account** with required services
3. **Create GitHub repo** with CI/CD via Cloudflare Pages
4. **Build orchestrator first** as the coordination layer
5. **Iterate on agents** one at a time with unit tests

---

*Document version: 1.0*  
*Last updated: January 2025*
