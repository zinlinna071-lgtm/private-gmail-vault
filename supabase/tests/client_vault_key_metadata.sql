-- Disposable PostgreSQL tests for the client crypto metadata schema.
-- The migration stores only public KDF parameters and an authenticated wrapped DEK.

insert into auth.users (id)
values ('70000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.vault_profiles (user_id)
values ('70000000-0000-4000-8000-000000000001')
on conflict (user_id) do nothing;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
    from public.vault_profiles
   where user_id = '70000000-0000-4000-8000-000000000001'
     and client_crypto_version is null
     and client_kdf_algorithm is null
     and client_kdf_profile is null
     and client_kdf_salt is null
     and client_wrapped_dek_iv is null
     and client_wrapped_dek is null;
  if v_count <> 1 then
    raise exception 'Existing Vault profile must remain in legacy state by default';
  end if;

  update public.vault_profiles
     set client_crypto_version = 1,
         client_kdf_algorithm = 'argon2id-v1.3',
         client_kdf_profile = 1,
         client_kdf_salt = 'AAAAAAAAAAAAAAAAAAAAAA==',
         client_wrapped_dek_iv = 'AAAAAAAAAAAAAAAA',
         client_wrapped_dek = repeat('A', 64),
         client_key_created_at = now()
   where user_id = '70000000-0000-4000-8000-000000000001';

  update public.vault_profiles
     set client_crypto_version = null,
         client_kdf_algorithm = null,
         client_kdf_profile = null,
         client_kdf_salt = null,
         client_wrapped_dek_iv = null,
         client_wrapped_dek = null,
         client_key_created_at = null
   where user_id = '70000000-0000-4000-8000-000000000001';

  begin
    update public.vault_profiles
       set client_crypto_version = 1,
           client_kdf_algorithm = 'argon2id-v1.3',
           client_kdf_profile = 1,
           client_kdf_salt = null,
           client_wrapped_dek_iv = 'AAAAAAAAAAAAAAAA',
           client_wrapped_dek = repeat('A', 64),
           client_key_created_at = now()
     where user_id = '70000000-0000-4000-8000-000000000001';
    raise exception 'Partial client key metadata should have been rejected';
  exception when check_violation then
    null;
  end;

  begin
    update public.vault_profiles
       set client_crypto_version = 1,
           client_kdf_algorithm = 'argon2id-v1.3',
           client_kdf_profile = 9,
           client_kdf_salt = 'AAAAAAAAAAAAAAAAAAAAAA==',
           client_wrapped_dek_iv = 'AAAAAAAAAAAAAAAA',
           client_wrapped_dek = repeat('A', 64),
           client_key_created_at = now()
     where user_id = '70000000-0000-4000-8000-000000000001';
    raise exception 'Unsupported KDF profile should have been rejected';
  exception when check_violation then
    null;
  end;

  begin
    update public.vault_profiles
       set client_crypto_version = 1,
           client_kdf_algorithm = 'argon2id-v1.3',
           client_kdf_profile = 1,
           client_kdf_salt = 'short',
           client_wrapped_dek_iv = 'AAAAAAAAAAAAAAAA',
           client_wrapped_dek = repeat('A', 64),
           client_key_created_at = now()
     where user_id = '70000000-0000-4000-8000-000000000001';
    raise exception 'Malformed KDF salt should have been rejected';
  exception when check_violation then
    null;
  end;

  begin
    update public.vault_profiles
       set client_crypto_version = 1,
           client_kdf_algorithm = 'argon2id-v1.3',
           client_kdf_profile = 1,
           client_kdf_salt = 'AAAAAAAAAAAAAAAAAAAAAA==',
           client_wrapped_dek_iv = 'AAAAAAAAAAAAAAAA',
           client_wrapped_dek = repeat('A', 63),
           client_key_created_at = now()
     where user_id = '70000000-0000-4000-8000-000000000001';
    raise exception 'Malformed wrapped DEK should have been rejected';
  exception when check_violation then
    null;
  end;
end;
$$;

delete from public.vault_profiles
 where user_id = '70000000-0000-4000-8000-000000000001';
delete from auth.users
 where id = '70000000-0000-4000-8000-000000000001';
