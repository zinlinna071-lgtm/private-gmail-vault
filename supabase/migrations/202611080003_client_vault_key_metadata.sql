-- Public KDF metadata and wrapped per-Vault DEK for the future client-encrypted protocol.
-- This migration does not enable client-side encryption or change active CRUD behavior.
-- Existing rows remain in the legacy server-readable state until explicitly migrated.

alter table public.vault_profiles
  add column if not exists client_crypto_version smallint,
  add column if not exists client_kdf_algorithm text,
  add column if not exists client_kdf_profile smallint,
  add column if not exists client_kdf_salt text,
  add column if not exists client_wrapped_dek_iv text,
  add column if not exists client_wrapped_dek text,
  add column if not exists client_key_created_at timestamptz;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.vault_profiles'::regclass
       and conname = 'vault_profiles_client_crypto_metadata_check'
  ) then
    alter table public.vault_profiles
      add constraint vault_profiles_client_crypto_metadata_check
      check (
        (
          client_crypto_version is null
          and client_kdf_algorithm is null
          and client_kdf_profile is null
          and client_kdf_salt is null
          and client_wrapped_dek_iv is null
          and client_wrapped_dek is null
          and client_key_created_at is null
        )
        or
        (
          client_crypto_version is not null
          and client_kdf_algorithm is not null
          and client_kdf_profile is not null
          and client_kdf_salt is not null
          and client_wrapped_dek_iv is not null
          and client_wrapped_dek is not null
          and client_key_created_at is not null
          and client_crypto_version = 1
          and client_kdf_algorithm = 'argon2id-v1.3'
          and client_kdf_profile in (1, 2)
          and length(client_kdf_salt) = 24
          and right(client_kdf_salt, 2) = '=='
          and left(client_kdf_salt, 22) !~ '[^A-Za-z0-9+/]'
          and length(client_wrapped_dek_iv) = 16
          and client_wrapped_dek_iv !~ '[^A-Za-z0-9+/]'
          and length(client_wrapped_dek) = 64
          and client_wrapped_dek !~ '[^A-Za-z0-9+/]'
          and client_key_created_at is not null
      );
  end if;
end
$constraints$;

comment on column public.vault_profiles.client_crypto_version is
  'NULL means legacy server-readable prototype. Version 1 is reserved for the not-yet-enabled browser-encrypted protocol.';
comment on column public.vault_profiles.client_kdf_algorithm is
  'Public KDF identifier only; currently allowlisted as argon2id-v1.3 for protocol version 1.';
comment on column public.vault_profiles.client_kdf_profile is
  'Public fixed KDF profile ID (1 or 2); profile selection is not approved for production until mobile benchmarks and independent review.';
comment on column public.vault_profiles.client_kdf_salt is
  'Base64 16-byte random per-Vault salt. Not secret.';
comment on column public.vault_profiles.client_wrapped_dek_iv is
  'Base64 12-byte AES-256-GCM nonce for the wrapped DEK. Not secret.';
comment on column public.vault_profiles.client_wrapped_dek is
  'Base64 AES-256-GCM wrapped 32-byte DEK (48 bytes including authentication tag). Never store raw DEK or KEK.';
comment on column public.vault_profiles.client_key_created_at is
  'Timestamp for public key-envelope metadata lifecycle; contains no secret material.';

          and length(client_wrapped_dek_iv) = 16
          and client_wrapped_dek_iv !~ '[^A-Za-z0-9+/]'
      );
  end if;
end
$constraints$;

comment on column public.vault_profiles.client_crypto_version is
  'NULL means legacy server-readable prototype. Version 1 is reserved for the not-yet-enabled browser-encrypted protocol.';
comment on column public.vault_profiles.client_kdf_algorithm is
  'Public KDF identifier only; currently allowlisted as argon2id-v1.3 for protocol version 1.';
comment on column public.vault_profiles.client_kdf_profile is
  'Public fixed KDF profile ID (1 or 2); profile selection is not approved for production until mobile benchmarks and independent review.';
comment on column public.vault_profiles.client_kdf_salt is
  'Base64 16-byte random per-Vault salt. Not secret.';
comment on column public.vault_profiles.client_wrapped_dek_iv is
  'Base64 12-byte AES-256-GCM nonce for the wrapped DEK. Not secret.';
comment on column public.vault_profiles.client_wrapped_dek is
  'Base64 AES-256-GCM wrapped 32-byte DEK (48 bytes including authentication tag). Never store raw DEK or KEK.';
comment on column public.vault_profiles.client_key_created_at is
  'Timestamp for public key-envelope metadata lifecycle; contains no secret material.';

          and length(client_wrapped_dek) = 64
          and client_wrapped_dek !~ '[^A-Za-z0-9+/]'
      );
  end if;
end
$constraints$;

comment on column public.vault_profiles.client_crypto_version is
  'NULL means legacy server-readable prototype. Version 1 is reserved for the not-yet-enabled browser-encrypted protocol.';
comment on column public.vault_profiles.client_kdf_algorithm is
  'Public KDF identifier only; currently allowlisted as argon2id-v1.3 for protocol version 1.';
comment on column public.vault_profiles.client_kdf_profile is
  'Public fixed KDF profile ID (1 or 2); profile selection is not approved for production until mobile benchmarks and independent review.';
comment on column public.vault_profiles.client_kdf_salt is
  'Base64 16-byte random per-Vault salt. Not secret.';
comment on column public.vault_profiles.client_wrapped_dek_iv is
  'Base64 12-byte AES-256-GCM nonce for the wrapped DEK. Not secret.';
comment on column public.vault_profiles.client_wrapped_dek is
  'Base64 AES-256-GCM wrapped 32-byte DEK (48 bytes including authentication tag). Never store raw DEK or KEK.';
comment on column public.vault_profiles.client_key_created_at is
  'Timestamp for public key-envelope metadata lifecycle; contains no secret material.';

        )
      );
  end if;
end
$constraints$;

comment on column public.vault_profiles.client_crypto_version is
  'NULL means legacy server-readable prototype. Version 1 is reserved for the not-yet-enabled browser-encrypted protocol.';
comment on column public.vault_profiles.client_kdf_algorithm is
  'Public KDF identifier only; currently allowlisted as argon2id-v1.3 for protocol version 1.';
comment on column public.vault_profiles.client_kdf_profile is
  'Public fixed KDF profile ID (1 or 2); profile selection is not approved for production until mobile benchmarks and independent review.';
comment on column public.vault_profiles.client_kdf_salt is
  'Base64 16-byte random per-Vault salt. Not secret.';
comment on column public.vault_profiles.client_wrapped_dek_iv is
  'Base64 12-byte AES-256-GCM nonce for the wrapped DEK. Not secret.';
comment on column public.vault_profiles.client_wrapped_dek is
  'Base64 AES-256-GCM wrapped 32-byte DEK (48 bytes including authentication tag). Never store raw DEK or KEK.';
comment on column public.vault_profiles.client_key_created_at is
  'Timestamp for public key-envelope metadata lifecycle; contains no secret material.';
