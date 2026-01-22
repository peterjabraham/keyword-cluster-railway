# Keyword Cluster Engine Walkthrough (Beginner Friendly)

This guide covers the current Stage 1 build and the planned full build. Each
step includes: what it does, how to implement it (UI + Railway dashboard),
typical issues, and any restrictions you should know. It is written for someone
with minimal technical background, but it stays accurate for the actual system
you are building.

---

## Current Stage 1 Workflow (What Runs Now)

**What it does**
- Lets testers run Stage 1: input → cluster suggestions → keyword metrics → CSV.

**How to implement (Railway + UI)**
1. Deploy using the provided `Dockerfile` (builds `frontend/dist` and serves it from Express).
2. Add environment variables in Railway:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (optional, e.g. `gpt-4o-mini`)
   - `DATAFORSEO_LOGIN`
   - `DATAFORSEO_PASSWORD`
   - `DATABASE_URL` (from Postgres plugin)
3. Run migrations `migrations/001_initial.sql` and `migrations/002_project_outputs.sql`.
4. Open the app (single Railway URL) and use:
   - **Generate Clusters** (OpenAI)
   - Select clusters
   - **Run Keyword Analysis** (DataForSEO)
   - Download CSV from the results panel

**Active Stage 1 API endpoints**
- `POST /api/stage1/projects` (create project)
- `POST /api/stage1/projects/:id/clusters` (OpenAI cluster suggestions)
- `POST /api/stage1/projects/:id/selection` (persist selection)
- `POST /api/stage1/projects/:id/keywords` (DataForSEO metrics + enrichment)
- `GET /api/stage1/projects/:id/keywords?format=csv` (CSV export)
- `GET /api/dataforseo/test|errors|id_list|sanity`
- `GET /api/projects/:id/stream` (SSE status/output updates)

**Typical issues**
- **Missing DataForSEO credentials**: metrics are blank or errors show in Diagnostics.
- **Rate limiting**: queued banners appear; retry after a minute.
- **No metrics**: try US locale or disable min-volume filter.

**Restrictions**
- Stage 1 only; multi-agent pipeline is planned but not wired yet.

---

## Planned Full Build (Not Implemented Yet)
The steps below describe the future multi-agent system. Keep them for the
Advanced section later; they are not required for the current Stage 1 build.

---

## Step 1 — Create the Railway foundation

**What it does**
- Creates the cloud infrastructure your system depends on: database and runtime.

**How to implement (UI)**
1. Go to the Railway dashboard and create a new project.
2. Add a **Postgres** plugin to the project.
3. Copy the `DATABASE_URL` for later use.
4. (Optional) Add Redis later if you need caching.

**Typical issues**
- **Missing database URL**: the backend can’t connect without `DATABASE_URL`.
- **Wrong region**: pick a region close to your target users for latency.

**Restrictions**
- Railway services restart; anything in memory will reset unless persisted.

---

## Step 2 — Configure environment variables

**What it does**
- Connects your backend to third-party APIs and the database.

**How to implement (UI + file edit)**
1. In Railway, set environment variables:
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL` (optional, e.g. `gpt-4o-mini`)
   - `DATAFORSEO_LOGIN`
   - `DATAFORSEO_PASSWORD`
   - `DATABASE_URL` (from the Postgres plugin)
2. If you run locally, mirror these in a local `.env` file.

**Typical issues**
- **Wrong variable names**: a typo means the API client fails at runtime.
- **Empty values**: Railway will deploy, but the server will error on requests.

**Restrictions**
- Secrets should live only in Railway or your local env, not in Git.

---

## Step 3 — Create the database schema (migration)

**What it does**
- Creates tables for projects, clusters, keywords, routing rules, and evidence blocks.

**How to implement (UI + CLI)**
1. Use the migration file `migrations/001_initial.sql`.
2. Apply it with `psql` using `DATABASE_URL` or your preferred migration tool.

**Typical issues**
- **Connection errors** if `DATABASE_URL` is missing or incorrect.
- **Schema drift** if you later change table shape without a new migration.

**Restrictions**
- Keep SQL standard and add migrations for every schema change.

---

## Step 4 — Build the orchestrator (the brain)

**What it does**
- Receives user input, starts the pipeline, and provides status + outputs.

**How to implement (UI)**
1. Implement the API in `server/index.js`.
2. Configure the `/api/projects`, `/api/projects/:id/run`,
   `/api/projects/:id/status`, `/api/projects/:id/outputs/:type` routes.
3. Ensure the backend serves the frontend build from `frontend/dist`.

**Typical issues**
- **CORS failures** if frontend and API are on different domains.
- **Status not updating** if you store in-memory only (which resets on deploy).

**Restrictions**
- Railway services restart. Status must go into Postgres for real usage.

---

## Step 5 — Build the 7 agents (the skills)

**What it does**
- Each agent handles one part of the pipeline and returns structured output.

**How to implement (UI + code)**
1. Implement the 7 agents as modules or job steps:
   `url-extractor`, `competitor-analyzer`, `data-connector`,
   `keyword-expander`, `clustering-engine`, `intent-classifier`, `user-state-router`.
2. Invoke them from the orchestrator in the correct sequence.
3. Each agent validates input and returns structured JSON output.

**Typical issues**
- **Bad payloads** if schemas differ between agents.
- **Partial outputs** if you don’t write results to Postgres.

**Restrictions**
- Long jobs should be split into steps or background jobs to avoid timeouts.

---

## Step 6 — Build the frontend wizard UI

**What it does**
- Captures user input and shows results as each agent finishes.

**How to implement (UI)**
1. Build the React app in `frontend/`.
2. Build wizard steps:
   - Project Context
   - URLs & Pages
   - Audience & Roles
   - Constraints & Proof
   - Data Sources
   - User State Router
3. Serve the built app (`frontend/dist`) from the backend.
4. Add an output panel that updates as each agent completes.

**Typical issues**
- **Missing build output** if `frontend/dist` isn’t generated.
- **API base URL mismatch** if you deploy UI and API on different domains.

**Restrictions**
- The frontend is static; all backend logic must stay in Express.

---

## Step 7 — Add real-time updates + exports

**What it does**
- Streams progress in real time and allows exports (CSV/JSON).

**How to implement (UI + code)**
1. Create an SSE or WebSocket endpoint in the backend.
2. On each agent completion, push status updates.
3. Add export buttons in the UI to download CSV/JSON from output endpoints.

**Typical issues**
- **SSE buffering** if proxies don't flush updates promptly.
- **Large payloads** if you send full outputs every update.

**Restrictions**
- Long-lived connections need keepalive signals and careful payload sizing.

---

## Issues we pre-empted in the build

These were added to prevent the most common setup pain:
- **CORS handling** is now built into `shared/utils.ts` and used by the
  orchestrator, so the UI can call APIs across domains without preflight errors.
- **Placeholder status + outputs** are wired into `/status` and `/outputs`
  so the frontend can render immediately while you wire real agent logic.
- **Step wizard + output panel** are already in the UI so the flow matches the
  spec and the progressive output pattern can be connected to streaming later.

---

## What still needs to be wired

- Persist agent outputs to **Postgres**, not in-memory.
- Real data processing in each agent.
- SSE or WebSocket stream for status updates.
- CSV/JSON export endpoints.

