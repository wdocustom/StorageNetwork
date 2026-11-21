-- Plan devices: "network" = another browser on a device the buyer already
-- uses (same IP + OS within 24h), trusted without an emailed code.
alter table public.plan_buyer_devices drop constraint if exists plan_buyer_devices_verified_by_check;
alter table public.plan_buyer_devices
  add constraint plan_buyer_devices_verified_by_check
  check (verified_by = any (array['first', 'checkout', 'code', 'network']));
