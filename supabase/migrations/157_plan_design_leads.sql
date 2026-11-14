-- "Email me my design + this price": designer visitors who weren't ready to
-- buy leave an email; we send them their exact design with the $5-off link
-- and can follow up. One row per request. Server-only (service role).
CREATE TABLE IF NOT EXISTS plan_design_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  design text NOT NULL,
  design_name text,
  offer text,
  visitor_id text,
  emailed boolean NOT NULL DEFAULT false,
  purchased_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_plan_design_leads_email ON plan_design_leads (lower(email));
CREATE INDEX IF NOT EXISTS idx_plan_design_leads_created ON plan_design_leads (created_at DESC);
ALTER TABLE plan_design_leads ENABLE ROW LEVEL SECURITY;
