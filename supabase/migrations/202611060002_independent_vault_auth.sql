-- Independent Vault credentials: no phone, SIM, Gmail, or email dependency.
create extension if not exists citext;

create table if not exists public.vault_accounts (
  id uuid primary key default gen_random_uuid(),
  login_id citext not null unique,
  password_salt text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vault_accounts_login_id_format check (
    login_id::text ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{3,31}$'
  )
);

-- Vault-owned identities replace the initial placeholder auth.users references.
alter table public.vault_profiles drop constraint if exists vault_profiles_user_id_fkey;
alter table public.gmail_connections drop constraint if exists gmail_connections_user_id_fkey;
alter table public.vault_audit_events drop constraint if exists vault_audit_events_user_id_fkey;
alter table public.vault_profiles
  add constraint vault_profiles_user_id_fkey foreign key (user_id)
  references public.vault_accounts(id) on delete cascade;
alter table public.gmail_connections
  add constraint gmail_connections_user_id_fkey foreign key (user_id)
  references public.vault_accounts(id) on delete cascade;
alter table public.vault_audit_events
  add constraint vault_audit_events_user_id_fkey foreign key (user_id)
  references public.vault_accounts(id) on delete cascade;

create table if not exists public.vault_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.vault_accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists vault_sessions_user_idx on public.vault_sessions(user_id);
create index if not exists vault_sessions_expiry_idx on public.vault_sessions(expires_at);

create table if not exists public.vault_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.vault_accounts(id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists vault_recovery_codes_user_idx on public.vault_recovery_codes(user_id);

create table if not exists public.vault_auth_attempts (
  id bigint generated always as identity primary key,
  identity_hash text not null,
  attempted_at timestamptz not null default now()
);
create index if not exists vault_auth_attempts_identity_time_idx
  on public.vault_auth_attempts(identity_hash, attempted_at desc);

create or replace function public.consume_vault_auth_attempt(p_identity_hash text, p_limit integer default 8)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  recent_count integer;
begin
  delete from public.vault_auth_attempts where attempted_at < now() - interval '1 hour';
  select count(*) into recent_count from public.vault_auth_attempts
    where identity_hash = p_identity_hash and attempted_at > now() - interval '15 minutes';
  if recent_count >= p_limit then return false; end if;
  insert into public.vault_auth_attempts(identity_hash) values (p_identity_hash);
  return true;
end;
$$;

alter table public.vault_accounts enable row level security;
alter table public.vault_sessions enable row level security;
alter table public.vault_recovery_codes enable row level security;
alter table public.vault_auth_attempts enable row level security;
revoke all on public.vault_accounts, public.vault_sessions, public.vault_recovery_codes, public.vault_auth_attempts from anon, authenticated;
grant all on public.vault_accounts, public.vault_sessions, public.vault_recovery_codes, public.vault_auth_attempts to service_role;
revoke all on function public.consume_vault_auth_attempt(text, integer) from public, anon, authenticated;
grant execute on function public.consume_vault_auth_attempt(text, integer) to service_role;

comment on table public.vault_accounts is 'Independent Vault identities. Login IDs are not email addresses.';
comment on table public.vault_recovery_codes is 'One-time hashed recovery codes. Plaintext is shown only once at account creation.';
