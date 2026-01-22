# Keyword Cluster Engine

Agent-based keyword clustering pipeline with a step-based wizard UI and progressive
outputs. The system runs on **Railway** (Express + Postgres) and separates extraction
agents from sequential processing to keep work fast and observable.

## Overview

- **Frontend**: Vite + React wizard that collects project context, URLs, audience,
  constraints, and cluster selections. Output panel updates as each stage completes.
- **Backend (Express)**: Provides Stage 1 API endpoints, orchestrates OpenAI cluster
  suggestions and DataForSEO keyword metrics, and serves the frontend build.
- **Storage**: Railway Postgres via `projects` and `project_outputs` tables.
- **Real-time updates**: SSE stream at `/api/projects/:id/stream`.

## Project Layout

```
/frontend     # Vite + React SPA (built to dist/, served by Express)
/server       # Express backend (index.js)
/shared       # Shared types/schemas/utils
/migrations   # Postgres migrations
/skills       # Skill specs + scripts (future)
/docs         # Technical docs
```

## Docs

- `docs/keyword-cluster-tech-plan.md` — full technical plan
- `docs/keyword-cluster-walkthrough.md` — beginner-friendly implementation guide
- `docs/keyword-cluster-data-schema.md` — data schema + flow reference

## Railway MCP Server Integration

This project includes Railway MCP Server support for natural language deployment and
management. The configuration is at `.cursor/mcp.json`.

**Prerequisites**
- [Railway CLI](https://docs.railway.com/guides/cli) installed and authenticated.

**Example commands (in Cursor)**
- `Deploy this project to Railway and generate a domain.`
- `Pull environment variables for this project.`
- `Create a development environment cloned from production.`

See [Railway MCP Server docs](https://docs.railway.com/reference/mcp-server) for more.

## Environment Variables (Railway)

Set these in Railway (or `.env` locally):
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (optional, e.g. `gpt-4o-mini`)
- `DATAFORSEO_LOGIN`
- `DATAFORSEO_PASSWORD`
- `DATABASE_URL` (from Postgres plugin)

## Quick Start (Local)

```bash
# Install dependencies
npm install

# Build frontend
npm --workspace frontend run build

# Start server
npm --workspace server run start
```

Open `http://localhost:3000`.

## Deployment (Railway)

1. Push to GitHub.
2. Create a Railway project and link the repo.
3. Add Postgres plugin.
4. Set environment variables.
5. Deploy (Railway auto-builds using `Dockerfile`).