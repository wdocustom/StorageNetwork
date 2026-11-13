-- A lead that came from the DIY plans designer ("Rather have it built for
-- you?") remembers the exact design the customer built, in the plans'
-- compact form (e.g. "H4x4wts"), so the assigned installer can open the
-- customer's 3D guide and PDF from the job. Null for every other lead.
alter table public.leads
  add column if not exists plan_design text,
  add column if not exists plan_design_name text;

comment on column public.leads.plan_design is
  'DIY plans design code (tote-plans encodeTotePlanDesign) when the lead came from the plans designer';
comment on column public.leads.plan_design_name is
  'Optional design name (e.g. a bestseller) for plan_design';
