-- Add jig_plan_purchased flag to profiles
-- Tracks whether the installer has purchased the $9 Ladder Building Jig plans
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS jig_plan_purchased BOOLEAN DEFAULT false;
