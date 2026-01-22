# Keyword Cluster: Data Schema & Flow

## Purpose
Single source of truth for how data moves through the current Stage 1 system,
including Postgres tables, API payloads, and CSV output columns.

---

## Database Schema (Railway Postgres)

### Tables (current)
```sql
-- projects (base record + status stream)
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending',
  status_json JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- project_outputs (all structured outputs)
CREATE TABLE project_outputs (
  project_id TEXT REFERENCES projects(id),
  output_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, output_type)
);
```

**Current `output_type` values**
- `stage1_input`
- `stage1_clusters`
- `stage1_selected`
- `stage1_keywords`

---

## Stage 1 Flow (API + Persistence)

### 1) Create project
`POST /api/stage1/projects`

**Payload**
```json
{
  "targetUrl": "https://example.com",
  "competitors": ["https://comp1.com", "https://comp2.com"],
  "initialClusters": ["Cluster A", "Cluster B"],
  "industry": "Beauty",
  "audience": "Consumers",
  "constraints": ["exclude-term"],
  "country": "UK",
  "minVolumeEnabled": true,
  "marketType": "b2c",
  "maxClusters": 12,
  "maxRowsPerCluster": 50,
  "clusterLimitMode": "top"
}
```

**Stored**
- `project_outputs.stage1_input`

### 2) Generate cluster suggestions
`POST /api/stage1/projects/:id/clusters`

**Stored**
- `project_outputs.stage1_clusters`

**Cluster shape**
```json
{
  "id": "uuid",
  "name": "Lash growth serum",
  "intentStage": "awareness",
  "concern": "Beauty",
  "score": 82
}
```

### 3) Persist selection
`POST /api/stage1/projects/:id/selection`

**Payload**
```json
{ "selectedIds": ["uuid-1", "uuid-2"] }
```

**Stored**
- `project_outputs.stage1_selected`

### 4) Run keyword analysis
`POST /api/stage1/projects/:id/keywords`

**Notes**
- DataForSEO is throttled and queued.
- Filters applied:
  - Exclusions (constraints)
  - Min-volume filter (optional)
  - Per-cluster row cap (optional)
- Results are sorted by descending Search Volume.

**Stored**
- `project_outputs.stage1_keywords`

### 5) CSV export
- `GET /api/stage1/projects/:id/clusters?format=csv`
- `GET /api/stage1/projects/:id/keywords?format=csv`

---

## DataForSEO Integration (Stage 1)

**Endpoints used**
- `keywords_data/google_ads/keywords_for_keywords/live`
- `keywords_data/google_ads/search_volume/live`
- Diagnostics:
  - `/api/dataforseo/test`
  - `/api/dataforseo/errors`
  - `/api/dataforseo/id_list`
  - `/api/dataforseo/sanity`

**Input controls**
- `country` → DataForSEO `location_code`
- `minVolumeEnabled`
- `maxRowsPerCluster` (cap final rows per cluster)
- `clusterLimitMode` + `maxClusters` (optional; can be set to 0/none to disable)
 - Keyword sanitization removes symbols before DataForSEO requests.

---

## Keyword Output Row (Stage 1)

Each row stored in `stage1_keywords` includes:
```json
{
  "Keyword": "lash growth serum",
  "Search Volume": 4400,
  "CPC": 2.11,
  "Competition": 78,
  "Intent Stage": "decision",
  "Source Type (brand/generic)": "generic",
  "Competitor": "grandecosmetics",
  "Competitors Bidding": "",
  "Cluster": "Lash growth serum",
  "Concern": "Beauty"
}
```

---

## SSE Status + Output Stream

**Endpoint**
`GET /api/projects/:id/stream`

**Events**
- `status`: current agent status snapshot (for future pipeline)
- `output`: emitted when `project_outputs` are updated
- `keepalive`: heartbeat every 15 seconds

---

## Flow Diagram (Stage 1)

```
User inputs
   │
   ▼
Create project (stage1_input)
   │
   ▼
Generate clusters (stage1_clusters via OpenAI)
   │
   ▼
Select clusters (stage1_selected)
   │
   ▼
Run DataForSEO (stage1_keywords)
   │
   ▼
CSV export
```
