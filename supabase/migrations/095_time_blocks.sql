-- Time block scheduling: AM/PM availability per date
-- Replaces the need for granular hour rows. Installers mark
-- Morning (before 12pm) / Afternoon (12pm+) availability.

-- Per-date overrides: installer can toggle AM/PM per day.
-- If no override exists, the day uses defaults from profiles.default_time_blocks.
CREATE TABLE IF NOT EXISTS installer_schedule_overrides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  installer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  morning_available boolean DEFAULT true NOT NULL,
  afternoon_available boolean DEFAULT true NOT NULL,
  note text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(installer_id, date)
);

CREATE INDEX idx_schedule_overrides_installer_date
  ON installer_schedule_overrides(installer_id, date);

-- Default time blocks on profiles (which blocks are available on working days)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS default_time_blocks text[]
  DEFAULT ARRAY['morning', 'afternoon'];

-- Customer's preferred time block (stored with their booking)
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS time_preference text;

-- RLS
ALTER TABLE installer_schedule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Installers manage own overrides"
  ON installer_schedule_overrides
  FOR ALL
  USING (installer_id = auth.uid())
  WITH CHECK (installer_id = auth.uid());

-- Service role bypass for server actions
CREATE POLICY "Service role full access to schedule overrides"
  ON installer_schedule_overrides
  FOR ALL
  USING (auth.role() = 'service_role');
