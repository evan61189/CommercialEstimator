-- =========================================================
-- Migration 0002 — Execution Layer (Phase 1)
-- Applied to Supabase project ConstructionEstimator
-- (clxziihhymxjmrvvtlgh) on 2026-04-05.
--
-- Adds the work-queue and QC-gate tables that turn the
-- monitoring dashboard into an execution platform:
--   projects, jobs, deliverables, reviews,
--   dollar_checks, inbox_messages, sub_response_tracking
-- =========================================================

-- ---------- PROJECTS ----------
CREATE TABLE IF NOT EXISTS projects (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL UNIQUE,
  slug            TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL DEFAULT 'intake'
                    CHECK (status IN ('intake','scoping','pricing','itb_out','bids_in','leveling','proposal','sent','won','lost','archived')),
  gc_fee_pct      NUMERIC(5,2),
  bid_due_at      TIMESTAMPTZ,
  site_visit_at   TIMESTAMPTZ,
  drive_folder_id TEXT,
  drive_share_url TEXT,
  local_folder_path TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_status  ON projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_bid_due ON projects (bid_due_at);

-- ---------- JOBS ----------
CREATE TABLE IF NOT EXISTS jobs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  agent_role    TEXT NOT NULL CHECK (agent_role IN (
                  'director','senior-estimator','junior-estimator','procurement','administrator')),
  type          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','in_progress','pending_review','approved','blocked','done','cancelled')),
  title         TEXT NOT NULL,
  payload       JSONB DEFAULT '{}'::jsonb,
  result        JSONB,
  priority      INTEGER DEFAULT 5,
  attempts      INTEGER DEFAULT 0,
  last_error    TEXT,
  parent_job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_queue   ON jobs (agent_role, status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_project ON jobs (project_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status  ON jobs (status);

-- ---------- DELIVERABLES ----------
CREATE TABLE IF NOT EXISTS deliverables (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id       UUID REFERENCES projects(id) ON DELETE CASCADE,
  job_id           UUID REFERENCES jobs(id) ON DELETE SET NULL,
  kind             TEXT NOT NULL CHECK (kind IN (
                     'scope_analysis','budget_estimate','rfp_package','bid_distribution',
                     'itb_approval','itb_email','bid_leveling','proposal','drawing_log',
                     'sub_response_update','bid_learning_update','folder_setup','other')),
  title            TEXT NOT NULL,
  file_path        TEXT,
  drive_file_id    TEXT,
  drive_url        TEXT,
  version          INTEGER DEFAULT 1,
  created_by_agent TEXT NOT NULL,
  content_summary  TEXT,
  metadata         JSONB DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deliverables_project ON deliverables (project_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_kind    ON deliverables (kind);

-- ---------- REVIEWS ----------
CREATE TABLE IF NOT EXISTS reviews (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deliverable_id  UUID NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected','escalated')),
  reviewer        TEXT NOT NULL DEFAULT 'director'
                    CHECK (reviewer IN ('director','human')),
  checks          JSONB DEFAULT '[]'::jsonb,
  rules_passed    TEXT[],
  rules_failed    TEXT[],
  director_notes  TEXT,
  human_notes     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  decided_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reviews_status   ON reviews (status, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_delivery ON reviews (deliverable_id);

-- ---------- DOLLAR CHECKS ----------
CREATE TABLE IF NOT EXISTS dollar_checks (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deliverable_id    UUID NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
  project_id        UUID REFERENCES projects(id) ON DELETE CASCADE,
  trade             TEXT,
  line_item         TEXT,
  budgeted_amount   NUMERIC(14,2),
  actual_amount     NUMERIC(14,2),
  variance_amount   NUMERIC(14,2),
  variance_pct      NUMERIC(8,2),
  flag              TEXT CHECK (flag IN ('ok','over_budget','under_budget','missing_markup','needs_review')),
  flag_reason       TEXT,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_dollar_checks_project ON dollar_checks (project_id);
CREATE INDEX IF NOT EXISTS idx_dollar_checks_flag    ON dollar_checks (flag);

-- ---------- INBOX MESSAGES ----------
CREATE TABLE IF NOT EXISTS inbox_messages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_id        TEXT UNIQUE,
  gmail_thread_id TEXT,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  classification  TEXT CHECK (classification IN (
                    'new_job','bid_submitted','will_bid','no_bid','rfi','ambiguous','spam','other')),
  sender_email    TEXT,
  sender_name     TEXT,
  sender_company  TEXT,
  subject         TEXT,
  snippet         TEXT,
  has_attachments BOOLEAN DEFAULT false,
  attachment_names TEXT[],
  received_at     TIMESTAMPTZ,
  processed_at    TIMESTAMPTZ,
  processed_by_agent TEXT,
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inbox_project  ON inbox_messages (project_id);
CREATE INDEX IF NOT EXISTS idx_inbox_class    ON inbox_messages (classification);
CREATE INDEX IF NOT EXISTS idx_inbox_received ON inbox_messages (received_at DESC);

-- ---------- SUB RESPONSE TRACKING ----------
CREATE TABLE IF NOT EXISTS sub_response_tracking (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id        UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sub_company       TEXT NOT NULL,
  trade             TEXT NOT NULL,
  itb_package       TEXT,
  invited_at        TIMESTAMPTZ,
  confirmed_at      TIMESTAMPTZ,
  bid_received_at   TIMESTAMPTZ,
  no_bid_at         TIMESTAMPTZ,
  follow_up_1_at    TIMESTAMPTZ,
  follow_up_2_at    TIMESTAMPTZ,
  status            TEXT CHECK (status IN (
                      'invited','confirmed','bid_submitted','no_bid','pending','rfi','non_responsive')),
  bid_amount        NUMERIC(14,2),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sub_tracking_project ON sub_response_tracking (project_id);
CREATE INDEX IF NOT EXISTS idx_sub_tracking_company ON sub_response_tracking (sub_company);

-- ---------- updated_at TRIGGERS ----------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_jobs_updated BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sub_tracking_updated BEFORE UPDATE ON sub_response_tracking
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- REALTIME ----------
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE deliverables;
ALTER PUBLICATION supabase_realtime ADD TABLE reviews;
ALTER PUBLICATION supabase_realtime ADD TABLE dollar_checks;
ALTER PUBLICATION supabase_realtime ADD TABLE inbox_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE sub_response_tracking;

-- ---------- RLS ----------
ALTER TABLE projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliverables          ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews               ENABLE ROW LEVEL SECURITY;
ALTER TABLE dollar_checks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_response_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_projects"      ON projects              FOR SELECT USING (true);
CREATE POLICY "write_projects"     ON projects              FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "read_jobs"          ON jobs                  FOR SELECT USING (true);
CREATE POLICY "write_jobs"         ON jobs                  FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "read_deliverables"  ON deliverables          FOR SELECT USING (true);
CREATE POLICY "write_deliverables" ON deliverables          FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "read_reviews"       ON reviews               FOR SELECT USING (true);
CREATE POLICY "write_reviews"      ON reviews               FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "read_dollar"        ON dollar_checks         FOR SELECT USING (true);
CREATE POLICY "write_dollar"       ON dollar_checks         FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "read_inbox"         ON inbox_messages        FOR SELECT USING (true);
CREATE POLICY "write_inbox"        ON inbox_messages        FOR ALL    USING (true) WITH CHECK (true);
CREATE POLICY "read_sub_tracking"  ON sub_response_tracking FOR SELECT USING (true);
CREATE POLICY "write_sub_tracking" ON sub_response_tracking FOR ALL    USING (true) WITH CHECK (true);
