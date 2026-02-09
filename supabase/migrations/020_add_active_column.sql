-- Add active column to profiles for account deactivation
-- Deactivated accounts are hidden from the network but data is preserved

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Add index for filtering active installers in search
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles(active) WHERE active = true;

-- Update search policy to only show active profiles
-- (The actual filtering should be done in the application code)
COMMENT ON COLUMN public.profiles.active IS 'Whether the installer account is active. Deactivated accounts are hidden from network searches but data is preserved.';
