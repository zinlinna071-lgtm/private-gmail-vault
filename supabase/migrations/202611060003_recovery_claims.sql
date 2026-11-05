-- Make Recovery Code use single-flight and recoverable across Auth/DB operations.
alter table public.vault_profiles
  add column if not exists recovery_claim_token uuid,
  add column if not exists recovery_claim_expires_at timestamptz;

comment on column public.vault_profiles.recovery_claim_token is
  'Temporary server-only claim preventing concurrent recovery attempts.';
comment on column public.vault_profiles.recovery_claim_expires_at is
  'Expiry for a recovery claim; permits retry after interrupted requests.';

create or replace function public.claim_vault_recovery(
  p_user_id uuid,
  p_expected_hash text,
  p_expected_salt text,
  p_claim_token uuid,
  p_lease_seconds integer default 600
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if p_lease_seconds < 60 or p_lease_seconds > 1800 then
    raise exception 'Invalid recovery claim lease';
  end if;

  update public.vault_profiles
  set recovery_claim_token = p_claim_token,
      recovery_claim_expires_at = now() + make_interval(secs => p_lease_seconds)
  where user_id = p_user_id
    and recovery_code_hash = p_expected_hash
    and recovery_code_salt = p_expected_salt
    and (recovery_claim_token is null or recovery_claim_expires_at <= now());

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

create or replace function public.finish_vault_recovery(
  p_user_id uuid,
  p_claim_token uuid,
  p_new_hash text,
  p_new_salt text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  update public.vault_profiles
  set recovery_code_hash = p_new_hash,
      recovery_code_salt = p_new_salt,
      recovery_claim_token = null,
      recovery_claim_expires_at = null
  where user_id = p_user_id
    and recovery_claim_token = p_claim_token
    and recovery_claim_expires_at > now();

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

create or replace function public.release_vault_recovery(
  p_user_id uuid,
  p_claim_token uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  update public.vault_profiles
  set recovery_claim_token = null,
      recovery_claim_expires_at = null
  where user_id = p_user_id
    and recovery_claim_token = p_claim_token;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.claim_vault_recovery(uuid, text, text, uuid, integer) from public, anon, authenticated;
revoke all on function public.finish_vault_recovery(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.release_vault_recovery(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_vault_recovery(uuid, text, text, uuid, integer) to service_role;
grant execute on function public.finish_vault_recovery(uuid, uuid, text, text) to service_role;
grant execute on function public.release_vault_recovery(uuid, uuid) to service_role;
