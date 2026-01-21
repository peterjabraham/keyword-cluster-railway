# SEO Clustering Engine

Agent-based SEO clustering pipeline with a step-based wizard UI and progressive
outputs. The system runs on Cloudflare Workers, D1, KV, and Queues, and
separates extraction agents from sequential processing agents to keep work fast
and observable.

## Overview

- **Frontend (Cloudflare Pages)**: Vite + React wizard that collects project
  context, URLs, audience, constraints, data sources, and user-state routing
  inputs. Output panel updates as each agent completes.
- **Orchestrator Worker**: Receives project payloads, starts parallel agents,
  chains dependent tasks through queues, and serves status/output endpoints.
- **Agents (Workers)**:
  1. URL Extractor
  2. Competitor Analyzer
  3. Data Source Connector
  4. Keyword Expander
  5. Clustering Engine
  6. Intent Classifier
  7. User-State Router
- **Storage**:
  - D1 for structured outputs (clusters, keywords, routing rules)
  - KV for session state and cached intermediate results
- **Real-time updates**: WebSocket stream for agent status + partial outputs.

## Project Layout

```
/frontend     # Cloudflare Pages UI (Vite + React)
/workers      # Cloudflare Workers (orchestrator + agents)
/shared       # Shared types/schemas/utils
/migrations   # D1 migrations
/skills       # Skill specs + scripts
```

## Docs

- `docs/seo-clustering-tech-plan.md` — full technical plan
- `docs/seo-clustering-walkthrough.md` — beginner-friendly implementation guide

