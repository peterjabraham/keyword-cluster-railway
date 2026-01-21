# SEO Clustering Engine Walkthrough (Beginner Friendly)

This guide explains the full build in 7 steps. Each step includes: what it does,
how to implement it (UI + Cloudflare dashboard), typical issues, and any
restrictions you should know. It is written for someone with minimal technical
background, but it stays accurate for the actual system you are building.

---

## Step 1 — Create the Cloudflare foundation

**What it does**
- Creates the cloud infrastructure your system depends on: database, caches, and queues.

**How to implement (UI)**
1. Go to the Cloudflare dashboard.
2. Create a **D1 database** named `seo-clustering`.
3. Create three **KV namespaces**:
   - `SESSION_CACHE` (stores project session data)
   - `CRAWL_CACHE` (temporary crawl results)
   - `SERP_CACHE` (SERP lookups and intent signals)
4. Create **Queues**:
   - `extraction-complete`
   - `expansion-complete`
   - `clustering-complete`
   - `intent-complete`

**Typical issues**
- **Missing IDs**: you must copy each resource ID into `wrangler.toml`.
- **Wrong binding names**: Cloudflare uses the binding names in `wrangler.toml`
  as environment variables, so the name must match your worker code.

**Restrictions**
- D1 is still evolving; migrations are SQL-only and must be kept in sync.

---

## Step 2 — Configure `wrangler.toml`

**What it does**
- Connects your code to Cloudflare resources (D1, KV, Queues, Services).

**How to implement (UI + file edit)**
1. Copy the IDs for D1 and KV from the dashboard.
2. Update these placeholders in `wrangler.toml`:
   - `database_id`
   - `SESSION_CACHE`, `CRAWL_CACHE`, `SERP_CACHE`
3. Make sure the Queue names match exactly what you created.
4. Make sure `service` names match the names you will deploy your workers as.

**Typical issues**
- **Wrong service name** means bindings fail silently.
- **Queue consumer** config missing = pipeline never continues.

**Restrictions**
- Queues are regional; make sure your Workers and Queues are in the same region.

---

## Step 3 — Create the database schema (migration)

**What it does**
- Creates tables for projects, clusters, keywords, routing rules, and evidence blocks.

**How to implement (UI + CLI)**
1. Use the migration file `migrations/001_initial.sql`.
2. Apply it using `wrangler d1 execute` (you will do this once for each env).

**Typical issues**
- **Migrations fail** because the DB name in your command doesn't match the
  one in Cloudflare.
- **Schema drift** if you later change table shape without a new migration.

**Restrictions**
- D1 does not support everything a full SQLite does; use standard SQL only.

---

## Step 4 — Build the orchestrator (the brain)

**What it does**
- Receives user input, starts the pipeline, and provides status + outputs.

**How to implement (UI)**
1. Deploy the orchestrator worker using Cloudflare Workers.
2. Add service bindings for all agent workers.
3. Configure the `/api/projects`, `/api/projects/:id/run`,
   `/api/projects/:id/status`, `/api/projects/:id/outputs/:type` routes.

**Typical issues**
- **CORS failures** if frontend calls the worker from a different domain.
- **Status not updating** if you store in-memory only (which resets on deploy).

**Restrictions**
- Worker memory is ephemeral. Status must go into KV or D1 for real usage.

---

## Step 5 — Build the 7 agents (the skills)

**What it does**
- Each agent handles one part of the pipeline and returns structured output.

**How to implement (UI + code)**
1. Create 7 workers: `url-extractor`, `competitor-analyzer`, `data-connector`,
   `keyword-expander`, `clustering-engine`, `intent-classifier`, `user-state-router`.
2. Wire them into the orchestrator with service bindings.
3. Each worker validates input and returns structured JSON output.

**Typical issues**
- **Bad payloads** if schemas differ between workers.
- **Partial outputs** if you don’t write results to D1 or KV.

**Restrictions**
- Workers can time out on heavy tasks. Use queues to split long work.

---

## Step 6 — Build the frontend wizard UI

**What it does**
- Captures user input and shows results as each agent finishes.

**How to implement (UI)**
1. Use Cloudflare Pages for hosting the React app.
2. Build wizard steps:
   - Project Context
   - URLs & Pages
   - Audience & Roles
   - Constraints & Proof
   - Data Sources
   - User State Router
3. Add an output panel that updates as each worker completes.

**Typical issues**
- **API base URL mismatch** if you deploy UI and API on different domains.
- **WebSockets in Pages** require the API to support `wss://`.

**Restrictions**
- Pages is static hosting; all backend logic must stay in Workers.

---

## Step 7 — Add real-time updates + exports

**What it does**
- Streams progress in real time and allows exports (CSV/JSON).

**How to implement (UI + code)**
1. Create a WebSocket endpoint in the orchestrator (Durable Object or Worker).
2. On each agent completion, push updates to the WebSocket.
3. Add export buttons in the UI to download CSV/JSON from output endpoints.

**Typical issues**
- **WebSocket disconnects** if you don't keep the connection alive.
- **Large payloads** if you send full outputs every update.

**Restrictions**
- Durable Objects have location constraints; match them to your queues region.

---

## Issues we pre-empted in the build

These were added to prevent the most common setup pain:
- **CORS handling** is now built into `shared/utils.ts` and used by the
  orchestrator, so the UI can call APIs across domains without preflight errors.
- **Placeholder status + outputs** are wired into `/status` and `/outputs`
  so the frontend can render immediately while you wire real agent logic.
- **Step wizard + output panel** are already in the UI so the flow matches the
  spec and the progressive output pattern can be connected to WebSockets later.

---

## What still needs to be wired

- Persist agent outputs to **D1** or **KV**, not in-memory.
- Real data processing in each worker.
- WebSocket stream for status updates.
- CSV/JSON export endpoints.

