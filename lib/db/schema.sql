-- CASEMIND PostgreSQL schema. Safe to apply repeatedly.
-- Mirrors the Drizzle definitions in lib/db/schema.ts.

CREATE TABLE IF NOT EXISTS cases (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  content TEXT NOT NULL,
  investigation_day INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  analysis JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS people (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL DEFAULT 0,
  previous_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS claims (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL,
  statement TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unresolved',
  confidence INTEGER NOT NULL DEFAULT 50,
  supporting_evidence_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  contradicting_evidence_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  related_people TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  related_events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  last_updated_day INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL,
  evidence_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  time_label TEXT NOT NULL DEFAULT '',
  sort_minutes INTEGER,
  location TEXT NOT NULL DEFAULT '',
  people TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  investigation_day INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relationships (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL,
  evidence_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  kind TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  investigation_day INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contradictions (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL,
  evidence_id INTEGER NOT NULL,
  conflicting_evidence_id INTEGER NOT NULL,
  claim_id INTEGER,
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unresolved',
  investigation_day INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investigation_updates (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL,
  evidence_id INTEGER NOT NULL,
  investigation_day INTEGER NOT NULL,
  headline TEXT NOT NULL,
  what_changed JSONB NOT NULL,
  recalled_memories JSONB NOT NULL,
  memory_status JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS score_history (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL,
  person_id INTEGER NOT NULL,
  evidence_id INTEGER NOT NULL,
  investigation_day INTEGER NOT NULL,
  score INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  factors JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS evidence_case_day_idx ON evidence (case_id, investigation_day, id);
CREATE UNIQUE INDEX IF NOT EXISTS cases_slug_unique ON cases (slug);
CREATE INDEX IF NOT EXISTS people_case_idx ON people (case_id);
CREATE INDEX IF NOT EXISTS claims_case_idx ON claims (case_id);
CREATE INDEX IF NOT EXISTS events_case_day_idx ON events (case_id, investigation_day);
CREATE INDEX IF NOT EXISTS relationships_case_idx ON relationships (case_id);
CREATE INDEX IF NOT EXISTS contradictions_case_idx ON contradictions (case_id);
CREATE INDEX IF NOT EXISTS updates_case_day_idx ON investigation_updates (case_id, investigation_day);
CREATE INDEX IF NOT EXISTS score_history_case_person_idx ON score_history (case_id, person_id, investigation_day);

ALTER TABLE contradictions ALTER COLUMN status SET DEFAULT 'unresolved';
UPDATE contradictions SET status = 'unresolved' WHERE status = 'open';
