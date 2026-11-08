-- Enforce the Secondary Vault four-record limit inside PostgreSQL.
-- The profile row is locked for the duration of each insert transaction, so
-- concurrent requests for one account cannot both consume the final slot.
-- Existing profiles default to Secondary. Owner status must be provisioned
-- out-of-band; public registration never receives an Owner role from the client.

alter table public.vault_profiles
  add column if not exists account_type text not null default 'secondary';

do $constraint$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.vault_profiles'::regclass
       and conname = 'vault_profiles_account_type_check'
  ) then
    alter table public.vault_profiles
      add constraint vault_profiles_account_type_check
      check (account_type in ('secondary', 'owner'));
  end if;
end
$constraint$;

comment on column public.vault_profiles.account_type is
  'Server/database-managed account tier. Public registration is always Secondary; Owner must be provisioned out-of-band.';

-- Prevent the application service role from promoting an account to Owner.
-- Only the actual table owner (the trusted database migration/operator identity)
-- may assign the privileged account type out-of-band.
create or replace function public.guard_vault_profile_account_type()
returns trigger
language plpgsql
set search_path = ''
as $
declare
  v_table_owner name;
begin
  select pg_catalog.pg_get_userbyid(class.relowner)
    into v_table_owner
    from pg_catalog.pg_class as class
   where class.oid = 'public.vault_profiles'::regclass;

  if current_user <> v_table_owner
     and new.account_type is distinct from 'secondary' then
    raise exception using
      errcode = '42501',
      message = 'OWNER_ROLE_PROVISIONING_REQUIRES_DATABASE_OWNER';
  end if;

  return new;
end;
$;

drop trigger if exists vault_profiles_guard_account_type on public.vault_profiles;
create trigger vault_profiles_guard_account_type
before insert or update of account_type on public.vault_profiles
for each row execute function public.guard_vault_profile_account_type();

create or replace function public.create_vault_item_with_quota(
  p_user_id uuid,
  p_id uuid,
  p_ciphertext text,
  p_iv text,
  p_auth_tag text
)
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_type text;
  v_record_count integer;
begin
  if p_user_id is null or p_id is null
     or p_ciphertext is null or btrim(p_ciphertext) = ''
     or p_iv is null or btrim(p_iv) = ''
     or p_auth_tag is null or btrim(p_auth_tag) = '' then
    raise exception using errcode = '22023', message = 'INVALID_VAULT_ITEM';
  end if;

  -- Serialize inserts per Vault. This row lock is held until the caller's
  -- transaction commits or rolls back.
  select profile.account_type
    into v_account_type
    from public.vault_profiles as profile
   where profile.user_id = p_user_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'VAULT_PROFILE_REQUIRED';
  end if;

  if v_account_type = 'secondary' then
    select count(*)::integer
      into v_record_count
      from public.vault_items as item
     where item.user_id = p_user_id;

    if v_record_count >= 4 then
      raise exception using errcode = '23514', message = 'VAULT_SECONDARY_LIMIT_REACHED';
    end if;
  elsif v_account_type <> 'owner' then
    raise exception using errcode = '22023', message = 'INVALID_VAULT_ACCOUNT_TYPE';
  end if;

  return query
    insert into public.vault_items (id, user_id, ciphertext, iv, auth_tag)
    values (p_id, p_user_id, p_ciphertext, p_iv, p_auth_tag)
    returning vault_items.id, vault_items.created_at, vault_items.updated_at;
end;
$$;

-- All application inserts must use the quota-enforcing function. Keep normal
-- owner-scoped SELECT/UPDATE/DELETE operations available to the server API.
revoke insert on table public.vault_items from service_role;
revoke all on function public.create_vault_item_with_quota(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_vault_item_with_quota(uuid, uuid, text, text, text)
  to service_role;

comment on function public.create_vault_item_with_quota(uuid, uuid, text, text, text) is
  'Atomically inserts one encrypted Vault record. Secondary accounts are limited to four records; Owner accounts are exempt. Service-role only.';
