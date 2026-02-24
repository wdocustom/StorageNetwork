-- ═══════════════════════════════════════════════════════════════════════════
-- 042: Demo Bookings
--
-- Stores demo call bookings from the /demo page.
-- Prospects pick a date + time slot; we store their info and prevent
-- double-booking.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.demo_bookings (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text        NOT NULL,
  email      text        NOT NULL,
  phone      text,
  date       text        NOT NULL,   -- YYYY-MM-DD
  time       text        NOT NULL,   -- HH:MM (24h, Central)
  timezone          text DEFAULT 'America/Chicago',
  tool_experience   text,          -- "Never used" | "I've built a couple things" | "Professional"
  builds_currently  text,          -- "Yes" | "No"
  status            text DEFAULT 'confirmed',
  created_at        timestamptz DEFAULT now()
);

-- Prevent double-booking the same date+time
CREATE UNIQUE INDEX IF NOT EXISTS idx_demo_bookings_date_time
  ON public.demo_bookings (date, time)
  WHERE status = 'confirmed';

-- Enable RLS
ALTER TABLE public.demo_bookings ENABLE ROW LEVEL SECURITY;

-- Service-role (server actions) can do everything
CREATE POLICY "service_role_full_access"
  ON public.demo_bookings
  FOR ALL
  USING (true)
  WITH CHECK (true);
