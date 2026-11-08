-- One-time, short-lived, browser-session-bound challenges and claims issued by the public Curator puzzle.
-- Only the service role may read/write these rows or execute the consume functions.
create table if not exists public.curator_challenges (
  id uuid primary key default gen_random_uuid(),
  challenge_hash text not null unique,
  session_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint curator_challenges_hash_format check (challenge_hash ~ '^[a-f0-9]{64}$'),
  constraint curator_challenges_session_format check (session_hash ~ '^[a-f0-9]{64}$'),
  constraint curator_challenges_expiry check (expires_at > created_at)
);

create index if not exists curator_challenges_expiry_idx
  on public.curator_challenges (expires_at)
  where consumed_at is null;

alter table public.curator_challenges enable row level security;
revoke all on public.curator_challenges from anon, authenticated;
grant all on public.curator_challenges to service_role;

create or replace function public.consume_curator_challenge(
  p_challenge_hash text,
  p_session_hash text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  consumed_count integer;
begin
  update public.curator_challenges
     set consumed_at = now()
   where challenge_hash = p_challenge_hash
     and session_hash = p_session_hash
     and consumed_at is null
     and expires_at > now();
  get diagnostics consumed_count = row_count;
  return consumed_count = 1;
end;
$$;

revoke all on function public.consume_curator_challenge(text, text) from public, anon, authenticated;
grant execute on function public.consume_curator_challenge(text, text) to service_role;

create table if not exists public.curator_registration_claims (
  id uuid primary key default gen_random_uuid(),
  claim_hash text not null unique,
  session_hash text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint curator_registration_claims_hash_format check (claim_hash ~ '^[a-f0-9]{64}$'),
  constraint curator_registration_claims_session_format check (session_hash ~ '^[a-f0-9]{64}$'),
  constraint curator_registration_claims_expiry check (expires_at > created_at)
);

create index if not exists curator_registration_claims_expiry_idx
  on public.curator_registration_claims (expires_at)
  where consumed_at is null;

alter table public.curator_registration_claims enable row level security;
revoke all on public.curator_registration_claims from anon, authenticated;
grant all on public.curator_registration_claims to service_role;

create or replace function public.consume_curator_registration_claim(
  p_claim_hash text,
  p_session_hash text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  consumed_count integer;
begin
  update public.curator_registration_claims
     set consumed_at = now()
   where claim_hash = p_claim_hash
     and session_hash = p_session_hash
     and consumed_at is null
     and expires_at > now();
  get diagnostics consumed_count = row_count;
  return consumed_count = 1;
end;
$$;

revoke all on function public.consume_curator_registration_claim(text, text) from public, anon, authenticated;
grant execute on function public.consume_curator_registration_claim(text, text) to service_role;

-- Expired and consumed rows can be periodically removed by the database operator.
