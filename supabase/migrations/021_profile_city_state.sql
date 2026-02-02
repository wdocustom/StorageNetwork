-- Migration 021: Add city & state to installer profiles
-- Required for localized marketing scripts and profile completeness enforcement.
-- These fields are now mandatory in the UI (profile form blocks save without them).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city  text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state text;
