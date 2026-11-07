-- Private research authoring and review workflow.
-- Apply only to the intended Supabase project after owner approval.
-- Raw test output and credentials are never stored in this table.

create table if not exists public.security_research_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title_en text not null check (length(trim(title_en)) between 1 and 180),
  title_my text not null check (length(trim(title_my)) between 1 and 240),
  category text not null check (length(trim(category)) between 1 and 80),
  workflow_state text not null default 'DRAFT'
    check (workflow_state in (
      'DRAFT', 'TECHNICAL_REVIEW', 'SECURITY_PRIVACY_REVIEW',
      'BILINGUAL_REVIEW', 'OWNER_APPROVAL', 'READY_TO_PUBLISH',
      'WITHDRAWN'
    )),
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object'),
  reviews jsonb not null default '{}'::jsonb
    check (jsonb_typeof(reviews) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz,
  check ((workflow_state = 'READY_TO_PUBLISH') = (ready_at is not null))
);

create index if not exists security_research_drafts_owner_updated_idx
  on public.security_research_drafts (owner_user_id, updated_at desc);

alter table public.security_research_drafts enable row level security;
revoke all on table public.security_research_drafts from anon, authenticated;
grant all on table public.security_research_drafts to service_role;

create or replace function public.touch_security_research_draft_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists security_research_drafts_touch_updated_at on public.security_research_drafts;
create trigger security_research_drafts_touch_updated_at
before update on public.security_research_drafts
for each row execute function public.touch_security_research_draft_updated_at();
