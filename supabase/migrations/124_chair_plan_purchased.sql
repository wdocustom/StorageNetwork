-- Add chair_plan_purchased flag to profiles
-- Tracks whether the installer has purchased the $12 Low Boy Adirondack Chair plans
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS chair_plan_purchased BOOLEAN DEFAULT false;
