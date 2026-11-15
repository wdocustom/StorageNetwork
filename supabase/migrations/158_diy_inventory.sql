-- Smart Inventory for DIY plan buyers: a $5 lifetime add-on that unlocks the
-- same tote inventory installers' customers get (/rack/[token]) for racks
-- the buyer builds themselves, added over time from /plans/inventory.

-- Who owns the add-on: one row per buyer email (lifetime).
CREATE TABLE IF NOT EXISTS diy_inventory_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  stripe_session_id text UNIQUE,
  amount_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_diy_inventory_access_email ON diy_inventory_access (lower(email));
ALTER TABLE diy_inventory_access ENABLE ROW LEVEL SECURITY;

-- Where a rack came from: NULL = an installer's job (as before), 'diy' = a
-- plan buyer added it themselves. The rack page adapts its links to it.
ALTER TABLE public.inventory_racks ADD COLUMN IF NOT EXISTS source text;
