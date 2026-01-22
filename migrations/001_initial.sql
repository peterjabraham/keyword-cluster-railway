CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending'
);

CREATE TABLE clusters (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  level INTEGER NOT NULL,
  parent_id TEXT REFERENCES clusters(id),
  name TEXT NOT NULL,
  definition TEXT,
  intent_class TEXT,
  serp_page_type TEXT,
  mapped_url TEXT,
  evidence_required TEXT
);

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

CREATE TABLE competitor_features (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  competitor_domain TEXT NOT NULL,
  feature_type TEXT NOT NULL,
  has_page BOOLEAN DEFAULT FALSE,
  page_url TEXT,
  notes TEXT
);

CREATE TABLE proof_blocks (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  uncertainty_type TEXT NOT NULL,
  skeptic_question TEXT NOT NULL,
  proof_elements TEXT,
  artifact_to_build TEXT,
  placement TEXT
);
