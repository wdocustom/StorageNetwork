-- Plans funnel: what visitors do inside the designer (/plans/checkout)
-- between opening it and paying — change the size, open a sample, see the
-- price, tap buy, leave Facebook's in-app browser for Apple / Google Pay…
-- One row per event per page load (the client sends each event once).
-- visitor_id / session_id are the same anonymous ids platform_page_views
-- uses (localStorage sn_vid, sessionStorage sn_sid).
-- Written and read only by the server (service role).

CREATE TABLE IF NOT EXISTS plan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  detail text,
  visitor_id text,
  session_id text,
  in_app text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_events_created ON plan_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_events_visitor ON plan_events (visitor_id);

ALTER TABLE plan_events ENABLE ROW LEVEL SECURITY;
