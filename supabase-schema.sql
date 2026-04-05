-- Supabase schema for the Preconstruction AI Command Center
-- Run this in your Supabase SQL Editor to set up the database

-- Agent events table — stores every action taken by every agent
CREATE TABLE IF NOT EXISTS agent_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_role TEXT NOT NULL CHECK (agent_role IN (
    'director', 'senior-estimator', 'junior-estimator', 'procurement', 'administrator'
  )),
  status TEXT NOT NULL CHECK (status IN ('idle', 'working', 'reviewing', 'waiting', 'error')),
  action TEXT NOT NULL,
  category TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for fast queries by role and time
CREATE INDEX IF NOT EXISTS idx_agent_events_role_time ON agent_events (agent_role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_events_created ON agent_events (created_at DESC);

-- Agent snapshots — current state of each agent (upserted on each event)
CREATE TABLE IF NOT EXISTS agent_snapshots (
  role TEXT PRIMARY KEY CHECK (role IN (
    'director', 'senior-estimator', 'junior-estimator', 'procurement', 'administrator'
  )),
  status TEXT NOT NULL DEFAULT 'idle',
  current_action TEXT,
  last_activity_at TIMESTAMPTZ,
  event_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial snapshots for all 5 agents
INSERT INTO agent_snapshots (role, status, event_count) VALUES
  ('director', 'idle', 0),
  ('senior-estimator', 'idle', 0),
  ('junior-estimator', 'idle', 0),
  ('procurement', 'idle', 0),
  ('administrator', 'idle', 0)
ON CONFLICT (role) DO NOTHING;

-- Enable Realtime on both tables so the dashboard gets live updates
ALTER PUBLICATION supabase_realtime ADD TABLE agent_events;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_snapshots;

-- RLS policies — allow public read, service-role write
ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on agent_events" ON agent_events
  FOR SELECT USING (true);

CREATE POLICY "Allow service role insert on agent_events" ON agent_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read on agent_snapshots" ON agent_snapshots
  FOR SELECT USING (true);

CREATE POLICY "Allow service role update on agent_snapshots" ON agent_snapshots
  FOR ALL USING (true) WITH CHECK (true);

-- Function to auto-update snapshot when an event is inserted
CREATE OR REPLACE FUNCTION update_agent_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO agent_snapshots (role, status, current_action, last_activity_at, event_count, updated_at)
  VALUES (NEW.agent_role, NEW.status, NEW.action, NEW.created_at, 1, now())
  ON CONFLICT (role) DO UPDATE SET
    status = NEW.status,
    current_action = NEW.action,
    last_activity_at = NEW.created_at,
    event_count = agent_snapshots.event_count + 1,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_snapshot
AFTER INSERT ON agent_events
FOR EACH ROW EXECUTE FUNCTION update_agent_snapshot();
