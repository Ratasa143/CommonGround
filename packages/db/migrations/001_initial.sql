CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('wifi_outage')),
  location_id text NOT NULL,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'triage_proposed', 'in_progress', 'fix_applied', 'resolved')),
  summary text NOT NULL,
  eta_minutes integer CHECK (eta_minutes IS NULL OR eta_minutes BETWEEN 0 AND 10080),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS incidents_one_active_per_location_category
  ON incidents ((category, location_id) HASH)
  WHERE status <> 'resolved';

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL UNIQUE,
  report_text text NOT NULL,
  reporter_ref uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_incident_created_idx
  ON reports (incident_id, created_at DESC);

CREATE TABLE IF NOT EXISTS status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  from_status text,
  to_status text,
  reason text,
  actor_type text NOT NULL,
  actor_ref text,
  correlation_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS status_events_time_sharded_idx
  ON status_events ((yb_hash_code(created_at) % 3) ASC, created_at DESC, incident_id ASC)
  SPLIT AT VALUES ((1), (2));

CREATE TABLE IF NOT EXISTS bridge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  consent_id uuid NOT NULL UNIQUE,
  requester_ref uuid NOT NULL,
  location_id text NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'closed', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (window_end > window_start)
);
CREATE INDEX IF NOT EXISTS bridge_requests_location_window_idx
  ON bridge_requests (location_id, window_start, window_end);

CREATE TABLE IF NOT EXISTS bridge_circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL,
  starts_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'expired')),
  simulated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > starts_at)
);

CREATE TABLE IF NOT EXISTS bridge_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES bridge_circles(id) ON DELETE CASCADE,
  member_ref uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  UNIQUE (circle_id, member_ref)
);
CREATE INDEX IF NOT EXISTS bridge_members_circle_idx ON bridge_members (circle_id, joined_at);

CREATE TABLE IF NOT EXISTS human_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL,
  subject_id uuid NOT NULL,
  approver_ref text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subject_type, subject_id)
);

CREATE TABLE IF NOT EXISTS meko_call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id uuid NOT NULL,
  actor text NOT NULL,
  datapack text NOT NULL,
  tool_name text NOT NULL,
  request_redacted jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_redacted jsonb,
  outcome text NOT NULL CHECK (outcome IN ('success', 'failure', 'bypass')),
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  simulated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS meko_call_log_time_sharded_idx
  ON meko_call_log ((yb_hash_code(created_at) % 3) ASC, created_at DESC, correlation_id ASC)
  SPLIT AT VALUES ((1), (2));

CREATE TABLE IF NOT EXISTS outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  correlation_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outbox_claim_idx
  ON outbox (available_at, created_at)
  WHERE status IN ('pending', 'processing');
