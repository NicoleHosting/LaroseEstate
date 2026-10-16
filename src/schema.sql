CREATE TABLE IF NOT EXISTS larose_app_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  version BIGINT NOT NULL DEFAULT 1,
  document JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS larose_audit_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID,
  actor_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS larose_audit_events_session_created_idx
  ON larose_audit_events (session_id, created_at DESC);
