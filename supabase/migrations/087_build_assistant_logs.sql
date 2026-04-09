-- ═══════════════════════════════════════════════════════════════════════════
-- Build Assistant — Conversation Logging & Feedback
-- Enables self-improving AI through feedback loops
-- ═══════════════════════════════════════════════════════════════════════════

-- Every Q&A turn is logged with classification + calculation results
create table if not exists build_assistant_logs (
  id              uuid primary key default gen_random_uuid(),
  installer_id    uuid references profiles(id) on delete set null,
  session_id      text not null,            -- groups turns in one chat session
  turn_index      smallint not null,        -- 0-based turn number in session
  user_message    text not null,
  assistant_response text not null,
  actions_json    jsonb default '[]',       -- classification actions from generateObject
  calc_results_json jsonb default '[]',     -- calculation results
  model_name      text default 'gemini-2.0-flash',
  latency_ms      integer,                  -- total round-trip time
  quality_flags   jsonb default '{}',        -- auto-detected quality signals
  feedback_score  smallint,                 -- null=no feedback, 1=thumbs up, -1=thumbs down
  feedback_text   text,                     -- optional correction/comment (admin-set)
  created_at      timestamptz not null default now()
);

-- Indexes
create index idx_bal_session on build_assistant_logs (session_id, turn_index);
create index idx_bal_installer on build_assistant_logs (installer_id, created_at desc);
create index idx_bal_feedback on build_assistant_logs (feedback_score, created_at desc)
  where feedback_score is not null;
create index idx_bal_created on build_assistant_logs (created_at desc);

-- RLS
alter table build_assistant_logs enable row level security;

-- Authenticated users can insert (logging happens server-side via service role,
-- but allow authenticated insert for the feedback endpoint)
create policy "service_insert_bal"
  on build_assistant_logs for insert
  to service_role
  with check (true);

-- Service role full access (for admin analytics + prompt improvement queries)
create policy "service_role_full_bal"
  on build_assistant_logs for all
  to service_role
  using (true)
  with check (true);

-- Authenticated users can update feedback on their own logs
create policy "auth_update_feedback_bal"
  on build_assistant_logs for update
  to authenticated
  using (installer_id = auth.uid())
  with check (installer_id = auth.uid());
