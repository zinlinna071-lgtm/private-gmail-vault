-- Runs after the legacy quota fixture and client-ciphertext migration in CI.
-- Uses synthetic IDs only; never run against a production database.

do $$
declare
  v_scheme text;
  v_count integer;
begin
  perform public.create_client_vault_item_with_quota(
    '10000000-0000-4000-8000-000000000003',
    '60000000-0000-4000-8000-000000000001',
    encode(convert_to('opaque ciphertext only', 'UTF8'), 'base64'),
    'AAAAAAAAAAAAAAAA',
    'AAAAAAAAAAAAAAAAAAAAAA=='
  );

  select encryption_scheme into v_scheme
    from public.vault_items
   where id = '60000000-0000-4000-8000-000000000001';

  if v_scheme <> 'client-aes-256-gcm-v1' then
    raise exception 'Client record must be explicitly marked client-aes-256-gcm-v1';
  end if;

  select count(*)::integer into v_count
    from public.vault_items
   where user_id = '10000000-0000-4000-8000-000000000001'
     and encryption_scheme = 'legacy-server-v1';

  if v_count <> 3 then
    raise exception 'Existing records must remain classified as legacy-server-v1; found %', v_count;
  end if;

  if has_table_privilege('service_role', 'public.vault_items', 'INSERT') then
    raise exception 'service_role must not insert client-v1 rows outside the quota function';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.create_client_vault_item_with_quota(uuid,uuid,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'service_role must be allowed to call the client-v1 quota function';
  end if;
end;
$$;

-- The service role must not be able to relabel a legacy row as client-encrypted.
begin;
set local role service_role;
do $
begin
  begin
    update public.vault_items
       set encryption_scheme = 'client-aes-256-gcm-v1'
     where id = '20000000-0000-4000-8000-000000000001';
    raise exception 'Expected encryption scheme reclassification to be blocked';
  exception
    when insufficient_privilege then
      if sqlerrm <> 'VAULT_ENCRYPTION_SCHEME_IS_IMMUTABLE' then
        raise;
      end if;
  end;
end;
$$;
commit;
