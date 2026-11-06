-- PRIVATE GMAIL VAULT — AUTHENTICATOR VAULT SQL DRAFT
-- Status: REVIEW DRAFT ONLY. DO NOT RUN IN SUPABASE.
-- This file is intentionally outside supabase/migrations/ so it is not picked
-- up by normal migration workflows. It must be reviewed and explicitly approved
-- before being moved into the migrations directory or applied anywhere.
--
-- Additive only: does not modify vault_profiles, Gmail OAuth tables, or the
-- existing Recovery Code RPCs. No plaintext TOTP seeds or backup codes belong
-- in these tables.

begin;

create table if not exists public.vault_key_envelopes (
  user_id uuid primary key references auth.users(id) on delete cascade,

  password_wrapped_key_ciphertext text not null
    check (char_length(password_wrapped_key_ciphertext) between 1 and 4096),
  password_wrapped_key_iv text not null
    check (char_length(password_wrapped_key_iv) between 1 and 128),
  password_wrapped_key_auth_tag text not null
    check (char_length(password_wrapped_key_auth_tag) between 1 and 128),
  password_kdf_name text not null
    check (password_kdf_name in ('scrypt')),
  password_kdf_version text not null
    check (char_length(password_kdf_version) between 1 and 40),
  password_kdf_salt text not null
    check (char_length(password_kdf_salt) between 16 and 256),
  password_kdf_parameters jsonb not null
    check (jsonb_typeof(password_kdf_parameters) = 'object'),

  recovery_wrapped_key_ciphertext text not null
    check (char_length(recovery_wrapped_key_ciphertext) between 1 and 4096),
  recovery_wrapped_key_iv text not null
    check (char_length(recovery_wrapped_key_iv) between 1 and 128),
  recovery_wrapped_key_auth_tag text not null
    check (char_length(recovery_wrapped_key_auth_tag) between 1 and 128),
  recovery_kdf_name text not null
    check (recovery_kdf_name in ('scrypt')),
  recovery_kdf_version text not null
    check (char_length(recovery_kdf_version) between 1 and 40),
  recovery_kdf_salt text not null
    check (char_length(recovery_kdf_salt) between 16 and 256),
  recovery_kdf_parameters jsonb not null
    check (jsonb_typeof(recovery_kdf_parameters) = 'object'),

  schema_version integer not null default 1
    check (schema_version > 0),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vault_auth_factors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google'
    check (provider = 'google'),
  google_subject text not null
    check (char_length(google_subject) between 1 and 255),
  account_email text not null
    check (char_length(account_email) between 3 and 320),
  label text
    check (label is null or char_length(label) <= 120),

  totp_ciphertext text not null
    check (char_length(totp_ciphertext) between 1 and 8192),
  totp_iv text not null
    check (char_length(totp_iv) between 1 and 128),
  totp_auth_tag text not null
    check (char_length(totp_auth_tag) between 1 and 128),

  backup_codes_ciphertext text,
  backup_codes_iv text,
  backup_codes_auth_tag text,

  totp_algorithm text not null default 'SHA1'
    check (totp_algorithm = 'SHA1'),
  totp_digits smallint not null default 6
    check (totp_digits = 6),
  totp_period_seconds smallint not null default 30
    check (totp_period_seconds between 15 and 120),

  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz,

  constraint vault_auth_factors_user_provider_subject_unique
    unique (user_id, provider, google_subject),

  constraint vault_auth_factors_backup_ciphertext_bundle_check
    check (
      (backup_codes_ciphertext is null and backup_codes_iv is null and backup_codes_auth_tag is null)
      or
      (
        backup_codes_ciphertext is not null
        and char_length(backup_codes_ciphertext) between 1 and 32768
        and backup_codes_iv is not null
        and char_length(backup_codes_iv) between 1 and 128
        and backup_codes_auth_tag is not null
        and char_length(backup_codes_auth_tag) between 1 and 128
      )
    )
);

create index if not exists vault_auth_factors_user_created_idx
  on public.vault_auth_factors (user_id, created_at desc);

drop trigger if exists vault_key_envelopes_set_updated_at
  on public.vault_key_envelopes;
create trigger vault_key_envelopes_set_updated_at
  before update on public.vault_key_envelopes
  for each row execute function public.set_updated_at();

drop trigger if exists vault_auth_factors_set_updated_at
  on public.vault_auth_factors;
create trigger vault_auth_factors_set_updated_at
  before update on public.vault_auth_factors
  for each row execute function public.set_updated_at();

alter table public.vault_key_envelopes enable row level security;
alter table public.vault_auth_factors enable row level security;

-- Match the existing Vault convention: no direct browser-role table access.
-- Server routes must authenticate the Vault session and scope by session user_id.
revoke all on table public.vault_key_envelopes from anon, authenticated;
revoke all on table public.vault_auth_factors from anon, authenticated;
grant all on table public.vault_key_envelopes to service_role;
grant all on table public.vault_auth_factors to service_role;

comment on table public.vault_key_envelopes is
  'Encrypted wrappers for a random Vault Data Key. Contains no plaintext key material.';
comment on table public.vault_auth_factors is
  'Client-side encrypted TOTP seed and Google backup-code collection. Independent of Gmail OAuth connection state.';
comment on column public.vault_auth_factors.totp_ciphertext is
  'AES-256-GCM ciphertext only; plaintext TOTP seed must never be stored.';
comment on column public.vault_auth_factors.backup_codes_ciphertext is
  'AES-256-GCM ciphertext only; plaintext backup codes and per-code state must never be stored.';

commit;

-- REVIEW CHECKLIST (not executable):
-- [ ] Confirm KDF package/version and benchmark-derived parameters.
-- [ ] Validate parameter allowlists and upper bounds in server code, not only JSONB type.
-- [ ] Review AES-GCM IV/tag encoding and canonical versioned AAD contract.
-- [ ] Review RLS, grants, service-role route authorization, and cross-user isolation.
-- [ ] Review factor ownership, duplicate identity handling, and concurrent updates.
-- [ ] Every update must compare expected version and increment version atomically.
-- [ ] Review recovery wrapper + Recovery Code acknowledgement atomicity separately.
-- [ ] Add integration tests before moving this draft into supabase/migrations/.
