ALTER TABLE projects
ADD COLUMN status_json JSONB,
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE project_outputs (
  project_id TEXT REFERENCES projects(id),
  output_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, output_type)
);
