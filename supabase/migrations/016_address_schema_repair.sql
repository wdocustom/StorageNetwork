-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 016: Address Schema Repair
-- Migration 012 created: address_line1, city, state
-- But webhook writes: address_city, address_state, address_zip
-- This migration adds the missing columns so both naming conventions work.
-- Also adds proof_uploaded_at for tracking photo upload timestamps.
-- ═══════════════════════════════════════════════════════════════════════════

-- Add columns the webhook expects (address_city, address_state, address_zip)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS address_city  text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS address_state text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS address_zip   text;

-- Proof upload tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS proof_uploaded_at timestamptz;
