-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 143: Native app support (Capacitor iOS / Android shell)
--
-- 1. device_tokens     — APNs / FCM tokens, one row per device, owned by an
--                        installer. RLS scoped to the owning user.
-- 2. idempotency_keys  — replay guard for the native offline queue
--                        (mark-complete). Service-role only (RLS on, no
--                        policies), written from server actions.
--
-- NOT applied to production by the PR author. Review, then apply via the
-- normal migration path.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token        TEXT NOT NULL,
  platform     TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  app_version  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A device token belongs to exactly one account at a time; re-login on the
  -- same device re-points it (upsert on token).
  UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS device_tokens_user_idx ON public.device_tokens (user_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "device_tokens_select_own" ON public.device_tokens;
CREATE POLICY "device_tokens_select_own" ON public.device_tokens
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "device_tokens_insert_own" ON public.device_tokens;
CREATE POLICY "device_tokens_insert_own" ON public.device_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "device_tokens_update_own" ON public.device_tokens;
CREATE POLICY "device_tokens_update_own" ON public.device_tokens
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "device_tokens_delete_own" ON public.device_tokens;
CREATE POLICY "device_tokens_delete_own" ON public.device_tokens
  FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  user_id    UUID NOT NULL,
  key        TEXT NOT NULL,
  action     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- RLS on with no policies: only the service role (server actions) can touch it.
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
