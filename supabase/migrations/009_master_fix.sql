-- ═══════════════════════════════════════════════════════════════════════════
-- MASTER FIX: Run this ONCE in Supabase SQL Editor
-- Ensures ALL tables and columns match what the app code expects.
-- 100% idempotent — safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION A: PROFILES TABLE — ensure all columns exist
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trade_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS service_zip text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_account_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_details_submitted boolean DEFAULT false;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE USING (auth.uid() = id);

GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION B: LEADS TABLE — ensure all columns exist
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS quote_data jsonb;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS estimated_price numeric(10,2);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deposit_amount numeric(10,2) DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deposit_paid boolean DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS balance_due numeric(10,2) DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS customer_id uuid;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'pending';

-- Source column: drop old constraint, clean data, add new constraint
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_source_check;

UPDATE public.leads
SET source = 'platform'
WHERE source IS NULL
   OR source NOT IN ('platform', 'partner_link', 'installer_manual', 'affiliate', 'network', 'self');

ALTER TABLE public.leads
  ADD CONSTRAINT leads_source_check
  CHECK (source IN ('platform', 'partner_link', 'installer_manual', 'affiliate', 'network', 'self'));

ALTER TABLE public.leads ALTER COLUMN source SET DEFAULT 'platform';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON public.leads (customer_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION C: CUSTOMERS TABLE
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  address text,
  installer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  source text DEFAULT 'manual'
    CHECK (source IN ('manual', 'quote', 'booking', 'import'))
);

CREATE INDEX IF NOT EXISTS idx_customers_installer_id ON public.customers (installer_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers (email);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can insert own customers" ON public.customers;
DROP POLICY IF EXISTS "Users can update own customers" ON public.customers;

CREATE POLICY "Users can read own customers"
ON public.customers FOR SELECT USING (auth.uid() = installer_id);

CREATE POLICY "Users can insert own customers"
ON public.customers FOR INSERT WITH CHECK (auth.uid() = installer_id);

CREATE POLICY "Users can update own customers"
ON public.customers FOR UPDATE USING (auth.uid() = installer_id);

GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION D: WAITLIST TABLE
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  zip_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can join waitlist" ON public.waitlist;
DROP POLICY IF EXISTS "Service role reads waitlist" ON public.waitlist;

CREATE POLICY "Public can join waitlist"
ON public.waitlist FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role reads waitlist"
ON public.waitlist FOR SELECT USING (false);

CREATE INDEX IF NOT EXISTS idx_waitlist_email_zip ON public.waitlist (email, zip_code);


-- ═══════════════════════════════════════════════════════════════════════════
-- SECTION E: AVATARS STORAGE BUCKET
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_owner" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_owner" ON storage.objects;

CREATE POLICY "avatars_select_public"
ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_authenticated"
ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatars_update_owner"
ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatars_delete_owner"
ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


-- ═══════════════════════════════════════════════════════════════════════════
-- DONE. All tables, columns, policies, and storage are ready.
-- ═══════════════════════════════════════════════════════════════════════════
