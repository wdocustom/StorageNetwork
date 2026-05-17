-- ═══════════════════════════════════════════════════════════════════════════
-- 122: Seed past completed/paid (cash) job for a specific test user
--
-- Inserts a single completed-paid past job into the `leads` table for the
-- installer 071e4146-4a6e-4df8-b753-ce5204225b39.
--   • 4 × 2×4 HDX tote racks (no wheels, no tops)
--   • Marked paid (cash) — status=paid, payout_status=paid, deposit_paid=true
--   • Completed roughly one month ago
--
-- SAFE TO DELETE:
--   DELETE FROM leads
--     WHERE installer_id = '071e4146-4a6e-4df8-b753-ce5204225b39'
--     AND notes LIKE '%[SEED-122]%';
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO leads (
  installer_id, customer_name, customer_email, customer_phone,
  address_line1, address_city, address_state, address_zip,
  status, operational_status, payout_status, fee_status,
  source, is_network_lead,
  estimated_price, deposit_amount, deposit_paid, balance_due, sales_tax_amount,
  scheduled_at, completed_at, paid_at,
  quote_data, notes, created_at
) VALUES (
  '071e4146-4a6e-4df8-b753-ce5204225b39',
  'Jared & Megan Holloway', 'jared.holloway.va@gmail.com', '703-555-4827',
  '14207 Stonewater Ct', 'Chantilly', 'VA', '20151',
  'paid', 'completed', 'paid', 'standard',
  'installer_manual', false,
  1344.00, 201.60, true, 1142.40, 0,
  '2026-04-15 10:00:00+00', '2026-04-17 15:30:00+00', '2026-04-17 16:00:00+00',
  '[
    {"cols":2,"rows":4,"toteType":"HDX","hasTotes":true,"hasWheels":false,"hasTop":false,"price":336,"totalW":44,"totalH":69,"desc":"2×4 HDX Tote Rack (no wheels, no top)"},
    {"cols":2,"rows":4,"toteType":"HDX","hasTotes":true,"hasWheels":false,"hasTop":false,"price":336,"totalW":44,"totalH":69,"desc":"2×4 HDX Tote Rack (no wheels, no top)"},
    {"cols":2,"rows":4,"toteType":"HDX","hasTotes":true,"hasWheels":false,"hasTop":false,"price":336,"totalW":44,"totalH":69,"desc":"2×4 HDX Tote Rack (no wheels, no top)"},
    {"cols":2,"rows":4,"toteType":"HDX","hasTotes":true,"hasWheels":false,"hasTop":false,"price":336,"totalW":44,"totalH":69,"desc":"2×4 HDX Tote Rack (no wheels, no top)"}
  ]'::jsonb,
  '[SEED-122] Four 2×4 HDX tote racks, no wheels/no tops. Paid in full (cash) on completion.',
  '2026-04-09 09:00:00+00'
);

-- Bump installer completed_jobs counter so the dashboard reflects the seed
UPDATE profiles
  SET completed_jobs = COALESCE(completed_jobs, 0) + 1
  WHERE id = '071e4146-4a6e-4df8-b753-ce5204225b39';
