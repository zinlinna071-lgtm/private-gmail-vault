-- Distinguish legacy server-encrypted rows from browser-encrypted v1 envelopes.
-- Existing rows are explicitly classified as legacy; no data is decrypted or rewritten.
-- Apply only to a disposable/test database in CI until separately approved.

alter table public.vault_items
  add column if not exists encryption_scheme text not null default 'legacy-server-v1';

do $constraint$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.vault_items'::regclass
       and conname = 'vault_items_encryption_scheme_check'
  ) then
    alter table public.vault_items
      add constraint vault_items_encryption_scheme_check
      check (encryption_scheme in ('legacy-server-v1', 'client-aes-256-gcm-v1'));
  end if;
end
$constraint$;

create index if not exists vault_items_client_scheme_owner_updated_idx
  on public.vault_items (user_id, updated_at desc)
  where encryption_scheme = 'client-aes-256-gcm-v1';

-- Prevent the application service role from reclassifying a legacy row as
-- client-encrypted (or the reverse). The SECURITY DEFINER insert function
-- below runs as the trusted table owner and is the only application path
-- that can create a client-v1 row.
create or replace function public.guard_vault_item_encryption_scheme()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_table_owner name;
begin
  select pg_catalog.pg_get_userbyid(class.relowner)
    into v_table_owner
    from pg_catalog.pg_class as class
   where class.oid = 'public.vault_items'::regclass;

  if current_user <> v_table_owner then
    -- Preserve the existing server-encrypted CRUD path: service_role may
    -- continue inserting rows that use the legacy default scheme.
    -- Only the SECURITY DEFINER quota function may insert client-v1 rows.
    if (tg_op = 'INSERT' and new.encryption_scheme <> 'legacy-server-v1')
       or (tg_op = 'UPDATE' and new.encryption_scheme is distinct from old.encryption_scheme) then
      raise exception using
        errcode = '42501',
        message = 'VAULT_ENCRYPTION_SCHEME_IS_IMMUTABLE';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists vault_items_guard_encryption_scheme on public.vault_items;
create trigger vault_items_guard_encryption_scheme
before insert or update of encryption_scheme on public.vault_items
for each row execute function public.guard_vault_item_encryption_scheme();

revoke all on function public.guard_vault_item_encryption_scheme()
  from public, anon, authenticated, service_role;

create or replace function public.create_client_vault_item_with_quota(
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
     or p_ciphertext is null or btrim(p_ciphertext) = '' or length(p_ciphertext) > 26668
     or p_iv is null or length(p_iv) <> 16
     or p_auth_tag is null or length(p_auth_tag) <> 24 then
    raise exception using errcode = '22023', message = 'INVALID_CLIENT_VAULT_ENVELOPE';
  end if;

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
    insert into public.vault_items
      (id, user_id, ciphertext, iv, auth_tag, encryption_scheme)
    values
      (p_id, p_user_id, p_ciphertext, p_iv, p_auth_tag, 'client-aes-256-gcm-v1')
    returning vault_items.id, vault_items.created_at, vault_items.updated_at;
end;
$$;

revoke all on function public.create_client_vault_item_with_quota(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.create_client_vault_item_with_quota(uuid, uuid, text, text, text)
  to service_role;

comment on column public.vault_items.encryption_scheme is
  'legacy-server-v1 rows remain server-readable; client-aes-256-gcm-v1 rows contain browser-generated AES-256-GCM envelopes only.';
comment on function public.create_client_vault_item_with_quota(uuid, uuid, text, text, text) is
  'Atomically inserts a client-encrypted opaque envelope with the existing per-Vault record quota. Service-role only.';
