-- Canadian installers: per-installer country + settlement currency.
--
-- country  — where the installer operates. Derived from their home postal
--            code at onboarding (US ZIP → 'US', Canadian postal code → 'CA')
--            and pinned to the Stripe Connect account's country once one
--            exists (a Stripe account's country can never change).
-- currency — the currency every customer charge for this installer is
--            presented in. Direct charges settle on the installer's own
--            account, so this must match that account's default_currency.
--
-- Postal "keys" stored in service_zip / service_zips / territory_zips.zip /
-- demand_signals.zip are either a 5-digit US ZIP or a 3-character Canadian
-- FSA ("M5V"); see src/lib/geo/postal.ts. Those columns are already text, so
-- no change is needed there.
--
-- Existing rows default to US / USD, which is what they are today.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_country_check') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_country_check CHECK (country IN ('US', 'CA'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_currency_check') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_currency_check CHECK (currency IN ('usd', 'cad'));
  END IF;
END $$;

-- Admin reporting filters by country.
CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles (country) WHERE country <> 'US';

-- Referral bounties that can't be paid by Stripe transfer — the referrer's
-- account is outside the US (Standard accounts can't receive cross-border
-- transfers) or the deposit was in CAD — are parked as 'manual_payout' with
-- bounty_amount recorded, for ops to settle by hand. See
-- src/lib/stripe/cross-border.ts.
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_bounty_status_check;
ALTER TABLE public.leads
  ADD CONSTRAINT leads_bounty_status_check
  CHECK (bounty_status IN ('none', 'pending', 'processing', 'paid', 'forfeited', 'manual_payout'));
