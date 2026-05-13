-- ═══════════════════════════════════════════════════════════════════════════
-- Realtor Gift Fulfillment — Phase A3
--
-- Adds the installer-side fulfillment surface:
--   - Three opt-in fields on profiles (active flag, on-hand tote stock,
--     concurrent-job capacity) so an installer can elect to dispatch
--     realtor gift packages alongside their normal install work.
--   - Two milestone timestamps on tote_rental_gifts (delivered_at,
--     returned_at) so we can render an audit timeline.
-- ═══════════════════════════════════════════════════════════════════════════

-- NOTE: previous migrations on main share numeric prefixes (two 107s, two
-- 108s) because PRs #41 / #42 were branched off a stale main. The next
-- prefix to use is 109. Future PRs should bump from here, not from 107/108.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tote_fulfillment_active boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tote_fulfillment_stock int NOT NULL DEFAULT 0
    CHECK (tote_fulfillment_stock >= 0);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tote_fulfillment_capacity int NOT NULL DEFAULT 5
    CHECK (tote_fulfillment_capacity >= 0);

-- Partial index — only the (small) set of installers that have actually
-- opted into fulfillment shows up in the assignment query. Combined with
-- the GIN index on service_zips that already exists for lead routing,
-- this keeps assignFulfillmentInstaller() cheap.
CREATE INDEX IF NOT EXISTS idx_profiles_tote_fulfillment_active
  ON public.profiles (id)
  WHERE tote_fulfillment_active = true;

-- ── Gift milestone timestamps ────────────────────────────────────────────

ALTER TABLE public.tote_rental_gifts
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

ALTER TABLE public.tote_rental_gifts
  ADD COLUMN IF NOT EXISTS returned_at timestamptz;

-- Index already exists on (installer_id, status) from 108. No new index
-- needed for the installer's "my jobs" query.
