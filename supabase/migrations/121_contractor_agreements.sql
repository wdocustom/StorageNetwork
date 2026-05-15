-- ═══════════════════════════════════════════════════════════════════════════
-- 121 — Contractor agreement signing
--
-- One-off legal contracts pushed to specific platform collaborators (NDA,
-- IP assignment, contractor terms, etc.). Modeled on the affiliate-agreement
-- pattern but with a few key differences:
--   • Body is custom markdown per row (not a templated commission config).
--   • Company side is pre-signed by name + timestamp at row creation.
--   • Contractor side accepts by typing their full name (legal "wet sig"
--     equivalent). Typed name + IP + UA are captured for the audit trail.
--   • A signing token gates a public /contracts/sign/<token> URL — emailed
--     via cron, so the contractor doesn't need to be logged in to sign.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.contractor_agreements (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Counterparty + display.
  contractor_id            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  contractor_name_snapshot text NOT NULL,
  contractor_email_snapshot text NOT NULL,

  -- Document.
  title                    text NOT NULL,
  body_md                  text NOT NULL,
  effective_date           date NOT NULL,

  -- Company side (pre-signed at insert time).
  company_signer_name      text NOT NULL,
  company_signed_at        timestamptz NOT NULL DEFAULT now(),

  -- Public signing URL gate. Long random UUID — the only thing protecting
  -- the public sign page. Unique so the URL is opaque + non-guessable.
  signature_token          uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  -- Email lifecycle (cron-driven).
  email_sent_at            timestamptz,
  email_send_attempts      int NOT NULL DEFAULT 0,
  last_email_error         text,

  -- Contractor signature audit trail.
  contractor_signed_at         timestamptz,
  contractor_typed_signature   text,
  contractor_signed_ip         text,
  contractor_signed_user_agent text,

  -- Lifecycle status.
  status                   text NOT NULL DEFAULT 'pending_send',

  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contractor_agreements_status_check
    CHECK (status IN ('pending_send', 'sent', 'signed', 'revoked'))
);

CREATE INDEX IF NOT EXISTS idx_contractor_agreements_contractor
  ON public.contractor_agreements (contractor_id)
  WHERE contractor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contractor_agreements_pending_send
  ON public.contractor_agreements (created_at)
  WHERE status = 'pending_send' AND email_sent_at IS NULL;

COMMENT ON TABLE public.contractor_agreements IS
  'One-off legal contracts (contractor / NDA / IP assignment) pushed to '
  'specific platform collaborators. body_md is rendered on the public '
  'signing page; contractor_typed_signature captures the legal acceptance. '
  'signature_token is the only thing gating the public sign URL — treat as a '
  'long-lived secret per row.';

-- ── RLS ───────────────────────────────────────────────────────────────────
-- The signing page reads via the signature_token (service-role action), so
-- the public client never queries this table directly. Authenticated
-- contractors can read their own row if a dashboard view is added later.

ALTER TABLE public.contractor_agreements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contractor reads own agreements"
  ON public.contractor_agreements;

CREATE POLICY "contractor reads own agreements"
  ON public.contractor_agreements
  FOR SELECT
  TO authenticated
  USING (contractor_id = auth.uid());

-- service_role bypasses RLS for the cron sender + the public signing
-- action (which authenticates via the signature_token, not auth.uid()).
