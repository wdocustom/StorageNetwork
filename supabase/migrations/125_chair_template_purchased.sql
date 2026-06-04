-- Add chair_template_purchased flag to profiles
-- Tracks whether the installer has purchased the $72 Low Boy Adirondack Chair MDF template
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS chair_template_purchased BOOLEAN DEFAULT false;
