-- Private Gmail Vault: initial database schema
-- Apply through the Supabase SQL Editor or Supabase CLI after creating a project.
-- OAuth material must be encrypted by the application before insertion.
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.vault_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  google_subject text not null,
  email_address text not null,
  display_name text,
  granted_scopes text[] not null default '{}',
  refresh_token_ciphertext text not null,
  refresh_token_iv text not null,
  refresh_token_auth_tag text not null,
  encryption_key_version integer not null default 1 check (encryption_key_version > 0),
  connection_status text not null default 'active'
    check (connection_status in ('active', 'reauthorization_required', 'revoked', 'error')),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gmail_connections_user_google_unique unique (user_id, google_subject),
  constraint gmail_connections_user_email_unique unique (user_id, email_address)
);
create index if not exists gmail_connections_user_created_idx
  on public.gmail_connections (user_id, created_at desc);

create table if not exists public.vault_audit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 80),
  outcome text not null check (outcome in ('success', 'failure', 'blocked')),
  connection_id uuid references public.gmail_connections(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists vault_audit_events_user_created_idx
  on public.vault_audit_events (user_id, created_at desc);

drop trigger if exists vault_profiles_set_updated_at on public.vault_profiles;
create trigger vault_profiles_set_updated_at before update on public.vault_profiles
for each row execute function public.set_updated_at();
drop trigger if exists gmail_connections_set_updated_at on public.gmail_connections;
create trigger gmail_connections_set_updated_at before update on public.gmail_connections
for each row execute function public.set_updated_at();

alter table public.vault_profiles enable row level security;
alter table public.gmail_connections enable row level security;
alter table public.vault_audit_events enable row level security;

-- No direct browser access. Server routes must authenticate and scope every
-- privileged query by the authenticated user's UUID.
revoke all on table public.vault_profiles from anon, authenticated;
revoke all on table public.gmail_connections from anon, authenticated;
revoke all on table public.vault_audit_events from anon, authenticated;
grant all on table public.vault_profiles to service_role;
grant all on table public.gmail_connections to service_role;
grant all on table public.vault_audit_events to service_role;
grant usage, select on sequence public.vault_audit_events_id_seq to service_role;

comment on table public.gmail_connections is
  'Server-managed Gmail OAuth connections. Refresh tokens must be AES-256-GCM encrypted before storage.';
comment on column public.gmail_connections.refresh_token_ciphertext is
  'Base64 ciphertext only; never store a plaintext OAuth refresh token.';
comment on table public.vault_audit_events is
  'Security audit metadata only. Do not store secrets, Gmail content, or OAuth tokens.';
