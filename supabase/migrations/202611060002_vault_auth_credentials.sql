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
