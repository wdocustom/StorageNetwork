-- ═══════════════════════════════════════════════════════════════════════════
-- Tote Inventory System — Customer-facing content tracking for storage racks
--
-- Each installed rack gets a unique access token. Customer scans a QR code
-- on the rack → opens /rack/[token] → sees a visual grid of tote slots →
-- taps a slot to add/view items inside that tote.
--
-- No customer auth required — access is via the unique token (like a share link).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Racks: each physical shelf unit installed for a customer ──────────────
CREATE TABLE IF NOT EXISTS public.inventory_racks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token  TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),

  -- Link to the job/lead that created this rack
  lead_id       UUID,
  installer_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Customer info (denormalized for easy display without joins)
  customer_name TEXT,
  customer_email TEXT,

  -- Rack configuration
  label         TEXT NOT NULL DEFAULT 'My Shelf',  -- e.g. "Garage Wall A", "Basement Rack"
  cols          INTEGER NOT NULL DEFAULT 4,
  rows          INTEGER NOT NULL DEFAULT 3,
  has_wheels    BOOLEAN DEFAULT false,
  top_type      TEXT DEFAULT 'none',
  layout        TEXT DEFAULT 'standard',           -- standard | sideways

  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_racks_token ON public.inventory_racks (access_token);
CREATE INDEX IF NOT EXISTS idx_inventory_racks_lead ON public.inventory_racks (lead_id);
CREATE INDEX IF NOT EXISTS idx_inventory_racks_email ON public.inventory_racks (customer_email);

-- ── Slots: each tote position on the rack grid ───────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rack_id       UUID NOT NULL REFERENCES public.inventory_racks(id) ON DELETE CASCADE,

  col           INTEGER NOT NULL,   -- 0-indexed column position
  row           INTEGER NOT NULL,   -- 0-indexed row position (0 = bottom)

  -- Customer-assigned label for this tote
  label         TEXT DEFAULT '',    -- e.g. "Christmas Decorations", "Power Tools"
  color         TEXT DEFAULT '',    -- optional color tag: red, blue, green, yellow, purple, orange
  photo_url     TEXT,               -- optional photo of tote contents

  notes         TEXT DEFAULT '',

  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE(rack_id, col, row)
);

CREATE INDEX IF NOT EXISTS idx_inventory_slots_rack ON public.inventory_slots (rack_id);

-- ── Items: individual things inside a tote slot ──────────────────────────
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id       UUID NOT NULL REFERENCES public.inventory_slots(id) ON DELETE CASCADE,

  name          TEXT NOT NULL,
  quantity      INTEGER DEFAULT 1,
  category      TEXT DEFAULT '',    -- e.g. "Holiday", "Tools", "Sports", "Kids", "Kitchen"
  photo_url     TEXT,               -- optional photo of this specific item
  notes         TEXT DEFAULT '',

  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_slot ON public.inventory_items (slot_id);

-- ── Full-text search across all items for a rack ─────────────────────────
-- Allows customer to search "screwdriver" and find which tote it's in
CREATE INDEX IF NOT EXISTS idx_inventory_items_name_search
  ON public.inventory_items USING GIN (to_tsvector('english', name || ' ' || COALESCE(category, '') || ' ' || COALESCE(notes, '')));

-- ── RLS ──────────────────────────────────────────────────────────────────
-- These tables are accessed via service_role from server actions (token-based auth),
-- not via Supabase client-side auth. RLS is enabled but policies allow service_role.
ALTER TABLE public.inventory_racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

-- Service role has full access (server actions handle authorization via access_token)
CREATE POLICY "service_role_full_access_racks" ON public.inventory_racks
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_full_access_slots" ON public.inventory_slots
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_role_full_access_items" ON public.inventory_items
  FOR ALL USING (auth.role() = 'service_role');

-- Installers can read racks they created
CREATE POLICY "installers_read_own_racks" ON public.inventory_racks
  FOR SELECT USING (auth.uid() = installer_id);
