-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 008: Profiles Schema Repair & RLS Policy Fix
-- Fixes: "Failed to save changes" on Profile page
-- Idempotent: Safe to run multiple times
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Ensure all required columns exist
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

-- 2. Force Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. FIX UPDATE POLICY (The likely culprit)
-- Remove old/conflicting policies to ensure a clean slate
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Create explicit SELECT policy — anyone can read profiles
CREATE POLICY "Public profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- Create explicit INSERT policy — users can create their own profile row
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- Create explicit UPDATE policy — users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- 4. Grant permissions to authenticated role
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT ON public.profiles TO authenticated;
GRANT UPDATE ON public.profiles TO authenticated;

-- Also grant to anon for public profile reads (booking pages, etc.)
GRANT SELECT ON public.profiles TO anon;
