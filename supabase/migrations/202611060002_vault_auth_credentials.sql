-- Add independent Vault account identifiers and one-time recovery credentials.
alter table public.vault_profiles
  add column if not exists login_id text,
  add column if not exists recovery_code_hash text,
  add column if not exists recovery_code_salt text;

create unique index if not exists vault_profiles_login_id_unique
  on public.vault_profiles (lower(login_id))
  where login_id is not null;

comment on column public.vault_profiles.login_id is
  'Unique Vault username. Not a Gmail address or phone number.';
comment on column public.vault_profiles.recovery_code_hash is
  'scrypt hash of a one-time recovery code; never store the code itself.';
comment on column public.vault_profiles.recovery_code_salt is
  'Per-account random salt for the recovery code hash.';

-- Server-side rate limits for Vault account creation, sign-in and recovery.
create table if not exists public.vault_auth_rate_limits (
  bucket_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0)
);
alter table public.vault_auth_rate_limits enable row level security;
revoke all on table public.vault_auth_rate_limits from anon, authenticated;
grant all on table public.vault_auth_rate_limits to service_role;

create or replace function public.consume_vault_auth_attempt(
  p_bucket_hash text,
  p_max_attempts integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempts integer;
begin
  if p_max_attempts < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit configuration';
  end if;

  insert into public.vault_auth_rate_limits (bucket_hash, window_started_at, attempts)
  values (p_bucket_hash, now(), 1)
  on conflict (bucket_hash) do update
    set window_started_at = case
          when now() >= vault_auth_rate_limits.window_started_at + make_interval(secs => p_window_seconds)
          then now() else vault_auth_rate_limits.window_started_at end,
        attempts = case
          when now() >= vault_auth_rate_limits.window_started_at + make_interval(secs => p_window_seconds)
          then 1 else vault_auth_rate_limits.attempts + 1 end
  returning attempts into v_attempts;

  delete from public.vault_auth_rate_limits
  where window_started_at < now() - interval '2 days';

  return v_attempts <= p_max_attempts;
end;
$$;
revoke all on function public.consume_vault_auth_attempt(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_vault_auth_attempt(text, integer, integer) to service_role;
