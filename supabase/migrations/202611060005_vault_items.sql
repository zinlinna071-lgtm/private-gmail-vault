-- Store account credentials as authenticated ciphertext only.
create table if not exists public.vault_items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  auth_tag text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vault_items_user_updated_idx
  on public.vault_items (user_id, updated_at desc);

drop trigger if exists vault_items_set_updated_at on public.vault_items;
create trigger vault_items_set_updated_at before update on public.vault_items
for each row execute function public.set_updated_at();

alter table public.vault_items enable row level security;
revoke all on table public.vault_items from anon, authenticated;
grant all on table public.vault_items to service_role;

comment on table public.vault_items is
  'Encrypted account entries. The application encrypts the complete entry before storage; plaintext credentials must never be written to this table.';
comment on column public.vault_items.ciphertext is
  'Base64 AES-256-GCM ciphertext of one complete account entry.';
