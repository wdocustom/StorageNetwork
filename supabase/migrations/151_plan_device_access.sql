-- DIY plan links are per buyer, not per person-with-the-link.
--
-- A buyer's first device (or the one they paid on) is remembered by a cookie;
-- any other device must enter a 6-digit code emailed to the buyer. Up to 3
-- active devices per buyer email — verifying a 4th retires the least recently
-- used. Rows are never deleted, so "devices ever" is a sharing signal for
-- admin analytics. Written and read only by the server (service role).

CREATE TABLE IF NOT EXISTS plan_buyer_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  -- sha256 of the device cookie; the cookie value itself is never stored
  device_hash text NOT NULL,
  verified_by text NOT NULL CHECK (verified_by IN ('first', 'checkout', 'code')),
  user_agent text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (email, device_hash)
);

CREATE INDEX IF NOT EXISTS idx_plan_buyer_devices_email ON plan_buyer_devices (email);

CREATE TABLE IF NOT EXISTS plan_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  used_at timestamptz,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_access_codes_email ON plan_access_codes (email, created_at DESC);

ALTER TABLE plan_buyer_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_access_codes ENABLE ROW LEVEL SECURITY;
