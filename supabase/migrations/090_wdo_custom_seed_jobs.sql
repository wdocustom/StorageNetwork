-- ═══════════════════════════════════════════════════════════════════════════
-- 090: WDO Custom — Seed Jobs for Promo Materials & Walkthroughs
--
-- Inserts 12 realistic demo jobs into the WDO Custom installer account:
--   • 7 completed/paid (past jobs with full quote_data)
--   • 5 active (various pipeline stages)
--   • Mix of tote organizers, overhead ceiling storage, planter boxes
--   • Omaha, Nebraska customers with realistic names/addresses
--
-- SAFE TO DELETE: This migration only inserts rows into the `leads` table
-- scoped to the WDO Custom installer. To remove, delete all leads where
-- installer_id matches the WDO Custom profile and notes LIKE '%[SEED]%'.
-- ═══════════════════════════════════════════════════════════════════════════

-- WDO Custom installer ID (from profiles table)
DO $$
DECLARE
  wdo_id UUID := 'cc12ae7c-3ae1-46be-82b7-f7ba276878e5';
BEGIN

  -- ═══════════════════════════════════════════════════════════════════════
  -- COMPLETED / PAID JOBS (7)
  -- ═══════════════════════════════════════════════════════════════════════

  -- 1. Standard 4×4 with totes, wheels & top — bread and butter job
  INSERT INTO leads (
    installer_id, customer_name, customer_email, customer_phone,
    address_line1, address_city, address_state, address_zip,
    status, operational_status, payout_status, fee_status,
    source, is_network_lead,
    estimated_price, deposit_amount, deposit_paid, balance_due, sales_tax_amount,
    scheduled_at, completed_at, paid_at,
    quote_data, notes, created_at
  ) VALUES (
    wdo_id, 'Marcus Thompson', 'marcus.t@gmail.com', '402-555-1847',
    '4215 Maple St', 'Omaha', 'NE', '68104',
    'paid', 'completed', 'paid', 'standard',
    'installer_manual', false,
    720.00, 108.00, true, 612.00, 0,
    '2026-02-18 10:00:00+00', '2026-02-22 15:30:00+00', '2026-02-22 16:00:00+00',
    '[{"cols":4,"rows":4,"toteType":"HDX","hasTotes":true,"hasWheels":true,"hasTop":true,"price":720,"totalW":86.5,"totalH":72.5,"desc":"4×4 HDX w/ Totes, Wheels & Top"}]'::jsonb,
    '[SEED] Standard 4×4 build — repeat customer referral',
    '2026-02-15 09:00:00+00'
  ) ON CONFLICT DO NOTHING;

  -- 2. Indiana Joe preset — 3-unit build, large job
  INSERT INTO leads (
    installer_id, customer_name, customer_email, customer_phone,
    address_line1, address_city, address_state, address_zip,
    status, operational_status, payout_status, fee_status,
    source, is_network_lead,
    estimated_price, deposit_amount, deposit_paid, balance_due, sales_tax_amount,
    scheduled_at, completed_at, paid_at,
    quote_data, notes, created_at
  ) VALUES (
    wdo_id, 'Jennifer & Dave Kowalski', 'jenkowalski@yahoo.com', '402-555-3291',
    '8832 Blondo St', 'Omaha', 'NE', '68134',
    'paid', 'completed', 'paid', 'standard',
    'installer_manual', false,
    1050.00, 157.50, true, 892.50, 0,
    '2026-02-25 09:00:00+00', '2026-03-01 14:00:00+00', '2026-03-01 14:30:00+00',
    '[{"cols":2,"rows":4,"toteType":"HDX","hasTotes":true,"hasWheels":false,"hasTop":false,"price":315,"totalW":44,"totalH":69,"desc":"Indiana Joe — 2×4"},{"cols":2,"rows":2,"toteType":"HDX","hasTotes":true,"hasWheels":false,"hasTop":false,"price":210,"totalW":44,"totalH":37,"desc":"Indiana Joe — 2×2"},{"cols":2,"rows":4,"toteType":"HDX","hasTotes":true,"hasWheels":false,"hasTop":false,"price":315,"totalW":44,"totalH":69,"desc":"Indiana Joe — 2×4"}]'::jsonb,
    '[SEED] Indiana Joe preset — 3-unit garage wall install',
    '2026-02-20 14:00:00+00'
  ) ON CONFLICT DO NOTHING;

  -- 3. Large 7×4 unit — showcase build (split into two modules: 4×4 + 3×4)
  INSERT INTO leads (
    installer_id, customer_name, customer_email, customer_phone,
    address_line1, address_city, address_state, address_zip,
    status, operational_status, payout_status, fee_status,
    source, is_network_lead,
    estimated_price, deposit_amount, deposit_paid, balance_due, sales_tax_amount,
    scheduled_at, completed_at, paid_at,
    quote_data, notes, created_at
  ) VALUES (
    wdo_id, 'Robert Chen', 'rchen.omaha@gmail.com', '402-555-7764',
    '1105 S 72nd St', 'Omaha', 'NE', '68106',
    'paid', 'completed', 'paid', 'standard',
    'installer_manual', false,
    1380.00, 207.00, true, 1173.00, 0,
    '2026-03-05 10:00:00+00', '2026-03-08 16:00:00+00', '2026-03-08 16:30:00+00',
    '[{"cols":4,"rows":4,"toteType":"HDX","hasTotes":true,"hasWheels":false,"hasTop":true,"price":790,"totalW":86.5,"totalH":69,"desc":"7×4 Module A — 4×4 HDX w/ Top"},{"cols":3,"rows":4,"toteType":"HDX","hasTotes":true,"hasWheels":false,"hasTop":true,"price":590,"totalW":65.25,"totalH":69,"desc":"7×4 Module B — 3×4 HDX w/ Top"}]'::jsonb,
    '[SEED] Large 7×4 wall unit — full garage wall, two modules',
    '2026-03-01 11:00:00+00'
  ) ON CONFLICT DO NOTHING;

  -- 4. Overhead ceiling storage 3×4 + small tote organizer 2×3
  INSERT INTO leads (
    installer_id, customer_name, customer_email, customer_phone,
    address_line1, address_city, address_state, address_zip,
    status, operational_status, payout_status, fee_status,
    source, is_network_lead,
    estimated_price, deposit_amount, deposit_paid, balance_due, sales_tax_amount,
    scheduled_at, completed_at, paid_at,
    quote_data, notes, created_at
  ) VALUES (
    wdo_id, 'Sarah Lindgren', 'sarah.lindgren@outlook.com', '402-555-4418',
    '3340 N 90th St', 'Omaha', 'NE', '68134',
    'paid', 'completed', 'paid', 'standard',
    'installer_manual', false,
    890.00, 133.50, true, 756.50, 0,
    '2026-03-10 09:00:00+00', '2026-03-12 13:00:00+00', '2026-03-12 13:30:00+00',
    '[{"cols":3,"rows":4,"toteType":"HDX","hasTotes":true,"hasWheels":false,"hasTop":false,"price":540,"totalW":65.25,"totalH":69,"desc":"Overhead Ceiling Storage: 3 × 4 (12 totes)","overheadGridPresetId":"3x4"},{"cols":2,"rows":3,"toteType":"HDX","hasTotes":true,"hasWheels":false,"hasTop":false,"price":350,"totalW":44,"totalH":53,"desc":"2×3 HDX Tote Organizer"}]'::jsonb,
    '[SEED] Overhead ceiling + wall organizer combo — garage makeover',
    '2026-03-06 08:30:00+00'
  ) ON CONFLICT DO NOTHING;

  -- 5. Planter box job — two raised planter boxes
  INSERT INTO leads (
    installer_id, customer_name, customer_email, customer_phone,
    address_line1, address_city, address_state, address_zip,
    status, operational_status, payout_status, fee_status,
    source, is_network_lead,
    estimated_price, deposit_amount, deposit_paid, balance_due, sales_tax_amount,
    scheduled_at, completed_at, paid_at,
    quote_data, notes, created_at
  ) VALUES (
    wdo_id, 'Linda Ramirez', 'lindaramirez402@gmail.com', '402-555-8823',
    '5520 Center St', 'Omaha', 'NE', '68106',
    'paid', 'completed', 'paid', 'standard',
    'installer_manual', false,
    700.00, 105.00, true, 595.00, 0,
    '2026-03-14 11:00:00+00', '2026-03-16 12:00:00+00', '2026-03-16 12:30:00+00',
    '[{"cols":0,"rows":0,"toteType":"HDX","hasTotes":false,"hasWheels":false,"hasTop":false,"price":350,"totalW":0,"totalH":0,"desc":"Raised Planter Box — 48\" × 24\" w/ Bottom Shelf"},{"cols":0,"rows":0,"toteType":"HDX","hasTotes":false,"hasWheels":false,"hasTop":false,"price":350,"totalW":0,"totalH":0,"desc":"Raised Planter Box — 48\" × 24\" w/ Bottom Shelf"}]'::jsonb,
    '[SEED] Two matching raised cedar planter boxes — backyard patio',
    '2026-03-10 15:00:00+00'
  ) ON CONFLICT DO NOTHING;

  -- 6. Cornhusker preset — single 4×4 on wheels with top
  INSERT INTO leads (
    installer_id, customer_name, customer_email, customer_phone,
    address_line1, address_city, address_state, address_zip,
    status, operational_status, payout_status, fee_status,
    source, is_network_lead,
    estimated_price, deposit_amount, deposit_paid, balance_due, sales_tax_amount,
    scheduled_at, completed_at, paid_at,
    quote_data, notes, created_at
  ) VALUES (
    wdo_id, 'Mike Petersen', 'mpetersen85@gmail.com', '402-555-6137',
    '7201 Pacific St', 'Omaha', 'NE', '68114',
    'paid', 'completed', 'paid', 'standard',
    'installer_manual', false,
    720.00, 108.00, true, 612.00, 0,
    '2026-03-18 10:00:00+00', '2026-03-20 14:00:00+00', '2026-03-20 14:30:00+00',
    '[{"cols":4,"rows":4,"toteType":"HDX","hasTotes":true,"hasWheels":true,"hasTop":true,"price":720,"totalW":86.5,"totalH":72.5,"desc":"Cornhusker — 4×4 w/ Wheels & Top"}]'::jsonb,
    '[SEED] Cornhusker preset build — quick single-unit install',
    '2026-03-15 09:00:00+00'
  ) ON CONFLICT DO NOTHING;

  -- 7. Overhead 4×4 standalone — all ceiling storage
  INSERT INTO leads (
    installer_id, customer_name, customer_email, customer_phone,
    address_line1, address_city, address_state, address_zip,
    status, operational_status, payout_status, fee_status,
    source, is_network_lead,
    estimated_price, deposit_amount, deposit_paid, balance_due, sales_tax_amount,
    scheduled_at, completed_at, paid_at,
    quote_data, notes, created_at
  ) VALUES (
    wdo_id, 'Tom & Angela Weber', 'webers.omaha@gmail.com', '402-555-2209',
    '12044 Arbor St', 'Omaha', 'NE', '68144',
    'paid', 'completed', 'paid', 'standard',
    'installer_manual', false,
    480.00, 72.00, true, 408.00, 0,
    '2026-03-22 09:00:00+00', '2026-03-24 11:00:00+00', '2026-03-24 11:30:00+00',
    '[{"cols":4,"rows":4,"toteType":"HDX","hasTotes":true,"hasWheels":false,"hasTop":false,"price":480,"totalW":0,"totalH":0,"desc":"Overhead Ceiling Storage: 4 × 4 (16 totes)","overheadGridPresetId":"4x4"}]'::jsonb,
    '[SEED] Full 4×4 overhead ceiling install — 16 totes, 2-car garage',
    '2026-03-19 10:00:00+00'
  ) ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════
  -- ACTIVE JOBS — various pipeline stages (5)
  -- ═══════════════════════════════════════════════════════════════════════

  -- 8. Deposit paid, scheduled — 3×3 with wheels, ready to install
  INSERT INTO leads (
    installer_id, customer_name, customer_email, customer_phone,
    address_line1, address_city, address_state, address_zip,
    status, operational_status, payout_status, fee_status,
    source, is_network_lead,
    estimated_price, deposit_amount, deposit_paid, balance_due, sales_tax_amount,
    scheduled_at,
    quote_data, notes, created_at
  ) VALUES (
    wdo_id, 'Brian Novak', 'bnovak.ne@gmail.com', '402-555-9034',
    '2518 S 147th Ave', 'Omaha', 'NE', '68144',
    'deposit_paid', 'scheduled', 'pending', 'standard',
    'installer_manual', false,
    540.00, 81.00, true, 459.00, 0,
    '2026-04-14 09:00:00+00',
    '[{"cols":3,"rows":3,"toteType":"HDX","hasTotes":true,"hasWheels":true,"hasTop":false,"price":540,"totalW":65.25,"totalH":55.5,"desc":"3×3 HDX w/ Totes & Wheels"}]'::jsonb,
    '[SEED] Scheduled install next week — deposit received',
    '2026-04-01 13:00:00+00'
  ) ON CONFLICT DO NOTHING;

  -- 9. Deposit paid, scheduled — Overhead 3×3 + planter box combo
  INSERT INTO leads (
    installer_id, customer_name, customer_email, customer_phone,
    address_line1, address_city, address_state, address_zip,
    status, operational_status, payout_status, fee_status,
    source, is_network_lead,
    estimated_price, deposit_amount, deposit_paid, balance_due, sales_tax_amount,
    scheduled_at,
    quote_data, notes, created_at
  ) VALUES (
    wdo_id, 'Patricia Hawkins', 'phawkins.omaha@gmail.com', '402-555-5512',
    '6610 Dodge St', 'Omaha', 'NE', '68132',
    'deposit_paid', 'scheduled', 'pending', 'standard',
    'installer_manual', false,
    730.00, 109.50, true, 620.50, 0,
    '2026-04-16 10:00:00+00',
    '[{"cols":3,"rows":3,"toteType":"HDX","hasTotes":true,"hasWheels":false,"hasTop":false,"price":380,"totalW":0,"totalH":0,"desc":"Overhead Ceiling Storage: 3 × 3 (9 totes)","overheadGridPresetId":"3x3"},{"cols":0,"rows":0,"toteType":"HDX","hasTotes":false,"hasWheels":false,"hasTop":false,"price":350,"totalW":0,"totalH":0,"desc":"Raised Planter Box — 36\" × 24\" w/ Bottom Shelf"}]'::jsonb,
    '[SEED] Overhead + planter box — scheduled for next week',
    '2026-04-03 10:00:00+00'
  ) ON CONFLICT DO NOTHING;

  -- 10. New lead, pending payment — Long Ranger preset
  INSERT INTO leads (
    installer_id, customer_name, customer_email, customer_phone,
    address_line1, address_city, address_state, address_zip,
    status, operational_status, payout_status, fee_status,
    source, is_network_lead,
    estimated_price, deposit_amount, deposit_paid, balance_due, sales_tax_amount,
    quote_data, notes, created_at
  ) VALUES (
    wdo_id, 'Derek & Emily Larson', 'emilyd.larson@gmail.com', '402-555-3378',
    '9205 Burt St', 'Omaha', 'NE', '68114',
    'pending_payment', 'new', 'pending', 'standard',
    'installer_manual', false,
    840.00, 126.00, false, 840.00, 0,
    '[{"cols":2,"rows":4,"toteType":"HDX","hasTotes":true,"hasWheels":false,"hasTop":false,"price":420,"totalW":44,"totalH":69,"desc":"Long Ranger — 2×4"},{"cols":4,"rows":2,"toteType":"HDX","hasTotes":true,"hasWheels":false,"hasTop":false,"price":420,"totalW":86.5,"totalH":37,"desc":"Long Ranger — 4×2"}]'::jsonb,
    '[SEED] Long Ranger preset — awaiting deposit payment',
    '2026-04-07 16:00:00+00'
  ) ON CONFLICT DO NOTHING;

  -- 11. New lead — large 4×4 + 2×3 combo, just quoted
  INSERT INTO leads (
    installer_id, customer_name, customer_email, customer_phone,
    address_line1, address_city, address_state, address_zip,
    status, operational_status, payout_status, fee_status,
    source, is_network_lead,
    estimated_price, deposit_amount, deposit_paid, balance_due, sales_tax_amount,
    quote_data, notes, created_at
  ) VALUES (
    wdo_id, 'Kathy Johannsen', 'kjohannsen@cox.net', '402-555-7741',
    '15320 Grover St', 'Omaha', 'NE', '68144',
    'quoted', 'new', 'pending', 'standard',
    'installer_manual', false,
    980.00, 147.00, false, 980.00, 0,
    '[{"cols":4,"rows":4,"toteType":"HDX","hasTotes":true,"hasWheels":true,"hasTop":true,"price":720,"totalW":86.5,"totalH":72.5,"desc":"4×4 HDX w/ Totes, Wheels & Top"},{"cols":2,"rows":3,"toteType":"HDX","hasTotes":true,"hasWheels":false,"hasTop":false,"price":260,"totalW":44,"totalH":53,"desc":"2×3 HDX Tote Organizer"}]'::jsonb,
    '[SEED] Two-unit quote — awaiting customer acceptance',
    '2026-04-08 11:00:00+00'
  ) ON CONFLICT DO NOTHING;

  -- 12. Deposit paid, scheduled — Planter box only job
  INSERT INTO leads (
    installer_id, customer_name, customer_email, customer_phone,
    address_line1, address_city, address_state, address_zip,
    status, operational_status, payout_status, fee_status,
    source, is_network_lead,
    estimated_price, deposit_amount, deposit_paid, balance_due, sales_tax_amount,
    scheduled_at,
    quote_data, notes, created_at
  ) VALUES (
    wdo_id, 'Greg Stanton', 'greg.stanton.omaha@gmail.com', '402-555-8860',
    '4402 Leavenworth St', 'Omaha', 'NE', '68105',
    'deposit_paid', 'scheduled', 'pending', 'standard',
    'installer_manual', false,
    450.00, 67.50, true, 382.50, 0,
    '2026-04-18 11:00:00+00',
    '[{"cols":0,"rows":0,"toteType":"HDX","hasTotes":false,"hasWheels":false,"hasTop":false,"price":450,"totalW":0,"totalH":0,"desc":"Raised Planter Box — 72\" × 24\" w/ Raised Legs & Liner"}]'::jsonb,
    '[SEED] Large planter box — scheduled for Friday',
    '2026-04-05 09:30:00+00'
  ) ON CONFLICT DO NOTHING;

  -- Update WDO Custom completed_jobs count to match seed data
  UPDATE profiles
    SET completed_jobs = GREATEST(completed_jobs, 7)
    WHERE id = wdo_id;

  RAISE NOTICE 'WDO Custom seed data inserted: 7 completed + 5 active jobs';

END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- CLEANUP INSTRUCTIONS:
-- To remove all seed data, run:
--   DELETE FROM leads WHERE notes LIKE '%[SEED]%'
--     AND installer_id = 'cc12ae7c-3ae1-46be-82b7-f7ba276878e5';
--   UPDATE profiles SET completed_jobs = 0
--     WHERE id = 'cc12ae7c-3ae1-46be-82b7-f7ba276878e5';
-- ═══════════════════════════════════════════════════════════════════════════
