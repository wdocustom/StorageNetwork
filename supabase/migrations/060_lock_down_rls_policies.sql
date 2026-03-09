-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 060: Lock Down Overly-Permissive RLS Policies
--
-- Several "service role full access" policies used USING (true) WITH CHECK
-- (true), which grants access to ALL authenticated users — not just the
-- service role. This replaces them with proper role-gated policies.
--
-- Affected tables: discount_codes, demo_bookings, qr_upload_sessions,
--                  qr_upload_images
-- ═══════════════════════════════════════════════════════════════════════════

-- ── discount_codes ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role full access" ON public.discount_codes;
CREATE POLICY "Service role full access"
  ON public.discount_codes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── demo_bookings ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "demo_bookings_service_full" ON public.demo_bookings;
CREATE POLICY "demo_bookings_service_full"
  ON public.demo_bookings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── qr_upload_sessions ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_full_access" ON public.qr_upload_sessions;
CREATE POLICY "service_role_full_access"
  ON public.qr_upload_sessions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── qr_upload_images ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "service_role_full_access" ON public.qr_upload_images;
CREATE POLICY "service_role_full_access"
  ON public.qr_upload_images FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
