-- Migration 019: Add logo_url to profiles for white-labeling
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "logo_url" text;
