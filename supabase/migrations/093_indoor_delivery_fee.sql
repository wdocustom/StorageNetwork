-- Add indoor delivery fee configuration to installer profiles.
-- Installers can charge an extra per-item fee when the customer wants
-- the rack brought inside the home (vs. free garage/driveway drop-off).
-- Default: enabled at $19 per item.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS indoor_delivery_fee_config JSONB
  DEFAULT '{"enabled": true, "fee": 19}'::jsonb;

COMMENT ON COLUMN profiles.indoor_delivery_fee_config IS
  'Indoor delivery fee config: { enabled: boolean, fee: number }. '
  'When enabled, customers are charged this per-item fee for in-home delivery.';
