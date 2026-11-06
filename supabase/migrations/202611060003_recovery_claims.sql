-- Recovery claims plus encrypted pending-code handoff.
-- Keep the current recovery hash active until the user explicitly acknowledges
-- that the newly issued code has been saved.

alter table public.vault_profiles
  add column if not exists recovery_claim_token uuid,
  add column if not exists recovery_claim_expires_at timestamptz,
  add column if not exists pending_recovery_code_hash text,
  add column if not exists pending_recovery_code_salt text,
  add column if not exists pending_recovery_code_ciphertext text,
  add column if not exists pending_recovery_code_iv text,
  add column if not exists pending_recovery_code_auth_tag text,
  add column if not exists pending_recovery_code_expires_at timestamptz;

comment on column public.vault_profiles.recovery_claim_token is
  'Temporary server-only claim preventing concurrent recovery attempts.';
comment on column public.vault_profiles.pending_recovery_code_ciphertext is
  'AES-256-GCM ciphertext of an unacknowledged Recovery Code; never plaintext.';
comment on column public.vault_profiles.pending_recovery_code_expires_at is
  'Pending code expiry; the previous active code remains valid until acknowledgement.';

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
  if p_user_id is null
     or p_expected_hash is null or btrim(p_expected_hash) = ''
     or p_expected_salt is null or btrim(p_expected_salt) = ''
     or p_claim_token is null then
    raise exception 'Invalid recovery claim parameters';
  end if;

  if p_lease_seconds is null or p_lease_seconds < 60 or p_lease_seconds > 1800 then
    raise exception 'Invalid recovery claim lease';
  end if;

  update public.vault_profiles
  set pending_recovery_code_hash = case when pending_recovery_code_expires_at <= now() then null else pending_recovery_code_hash end,
      pending_recovery_code_salt = case when pending_recovery_code_expires_at <= now() then null else pending_recovery_code_salt end,
      pending_recovery_code_ciphertext = case when pending_recovery_code_expires_at <= now() then null else pending_recovery_code_ciphertext end,
      pending_recovery_code_iv = case when pending_recovery_code_expires_at <= now() then null else pending_recovery_code_iv end,
      pending_recovery_code_auth_tag = case when pending_recovery_code_expires_at <= now() then null else pending_recovery_code_auth_tag end,
      pending_recovery_code_expires_at = case when pending_recovery_code_expires_at <= now() then null else pending_recovery_code_expires_at end,
      recovery_claim_token = p_claim_token,
      recovery_claim_expires_at = now() + make_interval(secs => p_lease_seconds)
  where user_id = p_user_id
    and recovery_code_hash = p_expected_hash
    and recovery_code_salt = p_expected_salt
    and (
      recovery_claim_token is null
      or recovery_claim_expires_at is null
      or recovery_claim_expires_at <= now()
    )
    and (pending_recovery_code_expires_at is null or pending_recovery_code_expires_at <= now());

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

create or replace function public.finish_vault_recovery(
  p_user_id uuid,
  p_claim_token uuid,
  p_pending_hash text,
  p_pending_salt text,
  p_ciphertext text,
  p_iv text,
  p_auth_tag text,
  p_expires_at timestamptz
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  if p_user_id is null or p_claim_token is null
     or p_pending_hash is null or btrim(p_pending_hash) = ''
     or p_pending_salt is null or btrim(p_pending_salt) = ''
     or p_ciphertext is null or btrim(p_ciphertext) = ''
     or p_iv is null or btrim(p_iv) = ''
     or p_auth_tag is null or btrim(p_auth_tag) = '' then
    raise exception 'Invalid pending Recovery Code material';
  end if;

  if p_expires_at is null
     or p_expires_at <= now()
     or p_expires_at > now() + interval '25 hours' then
    raise exception 'Invalid pending Recovery Code expiry';
  end if;

  update public.vault_profiles
  set pending_recovery_code_hash = p_pending_hash,
      pending_recovery_code_salt = p_pending_salt,
      pending_recovery_code_ciphertext = p_ciphertext,
      pending_recovery_code_iv = p_iv,
      pending_recovery_code_auth_tag = p_auth_tag,
      pending_recovery_code_expires_at = p_expires_at,
      recovery_claim_token = null,
      recovery_claim_expires_at = null
  where user_id = p_user_id
    and recovery_claim_token = p_claim_token
    and recovery_claim_expires_at > now()
    and pending_recovery_code_expires_at is null;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

create or replace function public.acknowledge_vault_recovery_code(
  p_user_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  update public.vault_profiles
  set recovery_code_hash = pending_recovery_code_hash,
      recovery_code_salt = pending_recovery_code_salt,
      pending_recovery_code_hash = null,
      pending_recovery_code_salt = null,
      pending_recovery_code_ciphertext = null,
      pending_recovery_code_iv = null,
      pending_recovery_code_auth_tag = null,
      pending_recovery_code_expires_at = null
  where user_id = p_user_id
    and pending_recovery_code_hash is not null
    and pending_recovery_code_salt is not null
    and pending_recovery_code_ciphertext is not null
    and pending_recovery_code_iv is not null
    and pending_recovery_code_auth_tag is not null
    and (pending_recovery_code_expires_at is null or pending_recovery_code_expires_at > now());

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
revoke all on function public.finish_vault_recovery(uuid, uuid, text, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.acknowledge_vault_recovery_code(uuid) from public, anon, authenticated;
revoke all on function public.release_vault_recovery(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_vault_recovery(uuid, text, text, uuid, integer) to service_role;
grant execute on function public.finish_vault_recovery(uuid, uuid, text, text, text, text, text, timestamptz) to service_role;
grant execute on function public.acknowledge_vault_recovery_code(uuid) to service_role;
grant execute on function public.release_vault_recovery(uuid, uuid) to service_role;
