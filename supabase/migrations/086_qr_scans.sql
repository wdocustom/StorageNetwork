-- ═══════════════════════════════════════════════════════════════════════════
-- QR Code Scan Tracking
-- Tracks when installer QR codes are scanned by customers
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists qr_scans (
  id          uuid primary key default gen_random_uuid(),
  installer_id uuid not null references profiles(id) on delete cascade,
  page_path   text not null,              -- e.g. "/p/joes-garage"
  referrer    text,
  user_agent  text,
  device_type text,                       -- mobile | tablet | desktop
  city        text,
  region      text,
  country     text,
  ip_hash     text,                       -- SHA-256 for dedup, never raw IP
  created_at  timestamptz not null default now()
);

-- Indexes for dashboard queries
create index idx_qr_scans_installer_created on qr_scans (installer_id, created_at desc);
create index idx_qr_scans_created on qr_scans (created_at desc);

-- RLS
alter table qr_scans enable row level security;

-- Anyone can insert (scan happens before auth)
create policy "anon_insert_qr_scans"
  on qr_scans for insert
  to anon, authenticated
  with check (true);

-- Installers can read their own scans
create policy "installer_read_own_qr_scans"
  on qr_scans for select
  to authenticated
  using (installer_id = auth.uid());

-- Service role has full access (for admin analytics)
create policy "service_role_full_qr_scans"
  on qr_scans for all
  to service_role
  using (true)
  with check (true);
