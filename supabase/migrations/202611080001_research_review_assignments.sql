-- Per-draft, per-stage reviewer assignments.
-- Apply only to the intended Supabase project after owner approval.
-- This migration does not change Vault data or production configuration.

create table if not exists public.security_research_review_assignments (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.security_research_drafts(id) on delete cascade,
  stage text not null check (stage in ('technical', 'security_privacy', 'bilingual')),
  reviewer_user_id uuid not null references auth.users(id) on delete cascade,
  assigned_by_owner_user_id uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > assigned_at),
  check (expires_at <= assigned_at + interval '30 days')
);

create index if not exists security_research_review_assignments_reviewer_active_idx
  on public.security_research_review_assignments (reviewer_user_id, stage, draft_id)
  where revoked_at is null;

create index if not exists security_research_review_assignments_draft_stage_idx
  on public.security_research_review_assignments (draft_id, stage, assigned_at desc);

alter table public.security_research_review_assignments enable row level security;
revoke all on table public.security_research_review_assignments from anon, authenticated;
grant all on table public.security_research_review_assignments to service_role;

comment on table public.security_research_review_assignments is
  'Owner-issued, expiring per-draft reviewer grants. Access is enforced by server routes; no client table access.';
