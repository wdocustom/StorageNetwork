-- Add installer-specific custom deposit configuration
-- deposit_config JSONB structure:
--   { "type": "percentage", "value": 25 }   -- 25% of build total
--   { "type": "flat",       "value": 200 }  -- flat $200 deposit
-- NULL = default 15% deposit rate
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deposit_config jsonb DEFAULT NULL;
