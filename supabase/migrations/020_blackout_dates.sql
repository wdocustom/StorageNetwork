-- Migration 020: Blackout dates for installer scheduling
-- Installers can block out date ranges when they're unavailable.
-- The booking flow checks this table before allowing a date selection.

CREATE TABLE IF NOT EXISTS installer_blackout_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT blackout_date_range CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_blackout_installer
  ON installer_blackout_dates(installer_id, start_date, end_date);
