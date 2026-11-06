-- Track the authenticated-encryption envelope format independently
-- from the key version. Existing rows use legacy AES-256-GCM without AAD.
alter table public.gmail_connections
  add column if not exists encryption_format_version integer not null default 1
  check (encryption_format_version > 0);

comment on column public.gmail_connections.encryption_format_version is
  'AES-GCM envelope format: 1 is legacy no-AAD; 2 binds ciphertext to Vault user and Google subject with AAD. This migration is additive; apply only after the documented schema/data preflight.';
