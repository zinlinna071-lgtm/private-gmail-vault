-- Runs only against a disposable PostgreSQL database prepared by
-- scripts/test-secondary-vault-quota.sh. No production data is involved.

insert into auth.users (id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000003')
on conflict (id) do nothing;

insert into public.vault_profiles (user_id, account_type) values
  ('10000000-0000-4000-8000-000000000001', 'secondary'),
  ('10000000-0000-4000-8000-000000000002', 'secondary'),
  ('10000000-0000-4000-8000-000000000003', 'owner')
on conflict (user_id) do update set account_type = excluded.account_type;

-- Leave three slots' worth of records? The concurrency fixture starts with
-- exactly three rows so two simultaneous inserts contend for one final slot.
insert into public.vault_items (id, user_id, ciphertext, iv, auth_tag) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'c1', 'i1', 't1'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'c2', 'i2', 't2'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'c3', 'i3', 't3'),
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000002', 'c1', 'i1', 't1'),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000002', 'c2', 'i2', 't2'),
  ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000002', 'c3', 'i3', 't3'),
  ('20000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000002', 'c4', 'i4', 't4')
on conflict (id) do nothing;

do $$
declare
  v_count integer;
  v_index integer;
begin
  -- A Secondary account already at four records must be rejected.
  begin
    perform public.create_vault_item_with_quota(
      '10000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000001',
      'ciphertext', 'nonce', 'tag'
    );
    raise exception 'Expected the fifth Secondary record to be rejected';
  exception
    when check_violation then
      if sqlerrm <> 'VAULT_SECONDARY_LIMIT_REACHED' then
        raise;
      end if;
  end;

  select count(*)::integer into v_count
    from public.vault_items
   where user_id = '10000000-0000-4000-8000-000000000002';
  if v_count <> 4 then
    raise exception 'Secondary quota test expected 4 rows, found %', v_count;
  end if;

  -- Owner accounts are not subject to the Secondary four-record quota.
  for v_index in 1..6 loop
    perform public.create_vault_item_with_quota(
      '10000000-0000-4000-8000-000000000003',
      ('40000000-0000-4000-8000-' || lpad(v_index::text, 12, '0'))::uuid,
      'ciphertext-' || v_index,
      'nonce-' || v_index,
      'tag-' || v_index
    );
  end loop;

  select count(*)::integer into v_count
    from public.vault_items
   where user_id = '10000000-0000-4000-8000-000000000003';
  if v_count <> 6 then
    raise exception 'Owner quota exemption expected 6 rows, found %', v_count;
  end if;

  if has_table_privilege('service_role', 'public.vault_items', 'INSERT') then
    raise exception 'service_role must not bypass the quota function with direct INSERT';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.create_vault_item_with_quota(uuid,uuid,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'service_role must be allowed to call the quota function';
  end if;
end;
$$;

-- A second Secondary account with exactly three records is used by the
-- shell script to race two inserts against the same final slot.
create or replace function public.test_try_secondary_insert(p_id uuid)
returns text
language plpgsql
as $$
begin
  perform public.create_vault_item_with_quota(
    '10000000-0000-4000-8000-000000000001',
    p_id,
    'race-ciphertext',
    'race-nonce',
    'race-tag'
  );
  return 'inserted';
exception
  when check_violation then
    if sqlerrm = 'VAULT_SECONDARY_LIMIT_REACHED' then
      return 'blocked';
    end if;
    raise;
end;
$$;
