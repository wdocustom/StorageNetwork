-- ═══════════════════════════════════════════════════════════════════════════
-- 043: QR Upload Sessions (persistent)
--
-- Replaces the in-memory session store that broke on serverless/Vercel
-- because each lambda invocation has its own memory space.
-- ═══════════════════════════════════════════════════════════════════════════

-- Sessions created by the desktop "Scan to Upload" QR flow
CREATE TABLE IF NOT EXISTS public.qr_upload_sessions (
  token      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 minutes')
);

-- Images uploaded from the phone within a session
CREATE TABLE IF NOT EXISTS public.qr_upload_images (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token uuid        NOT NULL REFERENCES public.qr_upload_sessions(token) ON DELETE CASCADE,
  url           text        NOT NULL,
  storage_path  text        NOT NULL,
  name          text        NOT NULL DEFAULT 'photo.jpg',
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_upload_images_session
  ON public.qr_upload_images (session_token);

-- RLS
ALTER TABLE public.qr_upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_upload_images   ENABLE ROW LEVEL SECURITY;

-- Service-role full access (server actions use service key)
CREATE POLICY "service_role_full_access" ON public.qr_upload_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "service_role_full_access" ON public.qr_upload_images
  FOR ALL USING (true) WITH CHECK (true);
