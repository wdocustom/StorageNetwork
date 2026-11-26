-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 168: Installer referral partners
--
-- An installer gives an outside business (a moving company, a realtor, a
-- self-storage facility) a referral link. Customers who come through it get
-- the installer's partner discount, and when their deposit is paid the
-- partner earns a cut the installer set:
--
--   referral_partners          one row per installer ↔ partner relationship:
--                              the share code, the partner's cut and the
--                              customer discount (a linked discount_codes
--                              row, so checkout validation is unchanged)
--   referral_partner_accounts  a partner's login (auth.users) → their Stripe
--                              Connect account for payouts. Partners get NO
--                              profiles row: they are not installers, and a
--                              profile would put them in installer queries
--                              (digests, matching, leaderboards).
--   referral_commissions       one row per referred lead whose deposit was
--                              paid: what the partner is owed and whether it
--                              was collected from the deposit, held, sent,
--                              or paid by the installer directly
--   referral_partner_emails    log of "you should check out…" emails a
--                              partner sent from their portal (rate limit +
--                              their sent list)
--   leads.referral_partner_id  attribution, stamped when the deposit is set
--                              up; partner_cut_cents is the snapshot of the
--                              cut at that moment
--
-- Portal invites: turning portal access on creates the partner's login right
-- away (no password) and emails a one-time link to set it.
--
-- Access: RLS on with no policies on the new tables — every read and write
-- goes through server actions on the service role, which do the ownership
-- checks (installer owns the partner row; partner's user_id matches).
-- Fully idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.referral_partners (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  installer_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name              text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email             text,
  -- Share code: /r/<code>, and the discount code the customer sees.
  code              text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{4,20}$'),
  -- The partner's cut of each referred job (on the job total after discount).
  cut_type          text NOT NULL DEFAULT 'percent' CHECK (cut_type IN ('percent', 'flat')),
  cut_value         numeric(10,2) NOT NULL DEFAULT 0 CHECK (cut_value >= 0),
  -- The customer discount, mirrored into discount_codes so the existing
  -- checkout validation applies it. NULL = no discount for this partner.
  discount_type     text CHECK (discount_type IN ('percent', 'fixed')),
  discount_value    numeric(10,2) CHECK (discount_value IS NULL OR discount_value > 0),
  discount_code_id  uuid REFERENCES public.discount_codes(id) ON DELETE SET NULL,
  -- Portal access, switched on by the installer. Off = a "basic" partner:
  -- just the link, the cut and the discount, and the installer pays the cut
  -- directly. On = the partner gets a login (user_id), their own dashboard,
  -- and Stripe payouts taken from the deposit.
  portal_enabled    boolean NOT NULL DEFAULT false,
  portal_invited_at timestamptz,
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_partners_percent_cap CHECK (cut_type <> 'percent' OR cut_value <= 50)
);

CREATE INDEX IF NOT EXISTS idx_referral_partners_installer ON public.referral_partners (installer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_partners_user ON public.referral_partners (user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.referral_partner_accounts (
  user_id                    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                      text NOT NULL,
  stripe_account_id          text UNIQUE,
  payouts_ready              boolean NOT NULL DEFAULT false,
  -- true when the account was created by a partner invite (not an existing
  -- Storage Network login). Only these can have a password set from an
  -- emailed link — an invite must never reset someone's existing account.
  created_by_invite          boolean NOT NULL DEFAULT false,
  -- One-time "set your password" link: SHA-256 of the token, never the token.
  password_token_hash        text UNIQUE,
  password_token_expires_at  timestamptz,
  password_set_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_partner_accounts_email ON public.referral_partner_accounts (lower(email));

CREATE TABLE IF NOT EXISTS public.referral_commissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id          uuid NOT NULL REFERENCES public.referral_partners(id) ON DELETE CASCADE,
  installer_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lead_id             uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  amount_cents        integer NOT NULL CHECK (amount_cents >= 0),
  currency            text NOT NULL DEFAULT 'usd',
  -- owed:        not collected from the deposit — the installer pays the partner directly
  -- held:        collected from the deposit; waiting for the partner's Stripe
  -- processing:  transfer claimed (guards against double-send)
  -- paid:        sent to the partner's Stripe
  -- manual_paid: the installer marked it paid outside the app
  -- void:        cancelled (no cut owed)
  status              text NOT NULL CHECK (status IN ('owed', 'held', 'processing', 'paid', 'manual_paid', 'void')),
  collected_cents     integer NOT NULL DEFAULT 0 CHECK (collected_cents >= 0),
  payment_intent_id   text,
  stripe_transfer_id  text,
  last_error          text,
  paid_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_commissions_partner ON public.referral_commissions (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_installer ON public.referral_commissions (installer_id, status);

CREATE TABLE IF NOT EXISTS public.referral_partner_emails (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id       uuid NOT NULL REFERENCES public.referral_partners(id) ON DELETE CASCADE,
  recipient_email  text NOT NULL,
  recipient_name   text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_partner_emails_partner ON public.referral_partner_emails (partner_id, created_at DESC);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS referral_partner_id uuid REFERENCES public.referral_partners(id) ON DELETE SET NULL;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS partner_cut_cents integer;
CREATE INDEX IF NOT EXISTS idx_leads_referral_partner ON public.leads (referral_partner_id) WHERE referral_partner_id IS NOT NULL;

ALTER TABLE public.referral_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_partner_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_partner_emails ENABLE ROW LEVEL SECURITY;
