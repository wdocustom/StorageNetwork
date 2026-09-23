-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 139: Post-deposit add-ons and customer tips
--
-- ADD-ONS: once a deposit is paid the quote used to be frozen — the only way
-- to add a plywood top or wheels at the last second was a second quote. Now
-- the installer can raise the quote after the deposit. Each raise is recorded
-- here as one row, and it carries its OWN deposit and platform fee, computed
-- on the add-on amount alone. Example (direct lead, 15% deposit, 3% fee):
--
--   $1,050 order → $157.50 deposit, $31.50 platform fee
--   +$150 top    →  $22.50 add-on deposit, $4.50 platform fee
--   total deposits $180 → $1,020 balance; installer nets $144 of deposits
--
-- Lifecycle of a row (status):
--   pending                → add-on deposit not collected yet
--   paid                   → add-on deposit charged (fee taken from it);
--                            leads.deposit_amount was increased by it
--   collected_with_balance → customer paid the final balance before paying
--                            the add-on deposit separately; the add-on's
--                            platform fee was taken from that balance charge
--   invoiced               → job was marked paid off-platform (cash/Venmo)
--                            with the add-on deposit still pending; the fee
--                            was invoiced to the installer instead
--
-- The add-on amount is added to leads.estimated_price and its tax to
-- leads.sales_tax_amount when the row is created, so every existing balance
-- calculation (estimated_price − deposit_amount − discount + tax) stays
-- correct whether or not the add-on deposit has been paid yet.
--
-- TIPS: leads.tip_amount records a tip the customer added on the balance
-- payment link. Tips carry no platform fee and no sales tax, and are never
-- part of estimated_price.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.lead_addons (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  installer_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Human-readable summary of what changed ("Unit 1: + Plywood top").
  description         TEXT,

  -- Money, in dollars (matches the leads table).
  amount              NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  deposit_amount      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  platform_fee        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
  sales_tax_amount    NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (sales_tax_amount >= 0),

  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'paid', 'collected_with_balance', 'invoiced')),

  -- Stripe PaymentIntent that paid the add-on deposit (status = 'paid').
  stripe_payment_intent_id TEXT DEFAULT NULL,

  paid_at             TIMESTAMPTZ DEFAULT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_addons_lead_id ON public.lead_addons (lead_id);

ALTER TABLE public.lead_addons ENABLE ROW LEVEL SECURITY;

-- An installer can see the add-ons on their own jobs.
CREATE POLICY "lead_addons_select_own" ON public.lead_addons
  FOR SELECT USING (installer_id = auth.uid());

-- Writes come only from server actions and the webhook (service role).
CREATE POLICY "lead_addons_service_all" ON public.lead_addons
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(10,2) DEFAULT NULL;
