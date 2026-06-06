-- Track Facebook referral chains: which customer share generated this lead
ALTER TABLE leads ADD COLUMN IF NOT EXISTS parent_lead_id UUID REFERENCES leads(id);
CREATE INDEX IF NOT EXISTS idx_leads_parent_lead_id ON leads(parent_lead_id) WHERE parent_lead_id IS NOT NULL;
