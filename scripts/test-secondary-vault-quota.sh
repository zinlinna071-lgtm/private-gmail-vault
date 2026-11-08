#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable PostgreSQL database}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT_DIR/supabase/migrations/202611080002_secondary_vault_record_quota.sql"
SQL_TEST="$ROOT_DIR/supabase/tests/secondary_vault_record_quota.sql"

# CI supplies a disposable PostgreSQL service. Never point this script at production.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$roles$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS public.vault_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.vault_items (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ciphertext text NOT NULL,
  iv text NOT NULL,
  auth_tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON TABLE public.vault_profiles, public.vault_items TO service_role;
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_TEST"

tmp_dir="$(mktemp -d)"
# The application service role may create normal Secondary profiles, but it
# must not promote or demote the privileged account tier.
if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -c "SET ROLE service_role; UPDATE public.vault_profiles SET account_type = 'owner' WHERE user_id = '10000000-0000-4000-8000-000000000001';" \
  > "$tmp_dir/promote.log" 2>&1; then
  echo "service_role unexpectedly promoted a Secondary profile to Owner" >&2
  exit 1
fi
if ! grep -q "OWNER_ROLE_PROVISIONING_REQUIRES_DATABASE_OWNER" "$tmp_dir/promote.log"; then
  cat "$tmp_dir/promote.log" >&2
  echo "Owner promotion was blocked for an unexpected reason" >&2
  exit 1
fi

if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -c "SET ROLE service_role; UPDATE public.vault_profiles SET account_type = 'secondary' WHERE user_id = '10000000-0000-4000-8000-000000000003';" \
  > "$tmp_dir/demote.log" 2>&1; then
  echo "service_role unexpectedly changed the Owner tier" >&2
  exit 1
fi
if ! grep -q "OWNER_ROLE_PROVISIONING_REQUIRES_DATABASE_OWNER" "$tmp_dir/demote.log"; then
  cat "$tmp_dir/demote.log" >&2
  echo "Owner demotion was blocked for an unexpected reason" >&2
  exit 1
fi

trap 'rm -rf "$tmp_dir"' EXIT

psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 \
  -c "select public.test_try_secondary_insert('50000000-0000-4000-8000-000000000001');" \
  > "$tmp_dir/one" &
pid_one=$!
psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 \
  -c "select public.test_try_secondary_insert('50000000-0000-4000-8000-000000000002');" \
  > "$tmp_dir/two" &
pid_two=$!
wait "$pid_one"
wait "$pid_two"

results="$(cat "$tmp_dir/one" "$tmp_dir/two" | tr -d '\r' | sed '/^[[:space:]]*$/d' | sort | tr '\n' ' ')"
if [[ "$results" != "blocked inserted " ]]; then
  echo "Concurrent Secondary quota enforcement was not atomic: $results" >&2
  exit 1
fi

final_count="$(psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 \
  -c "select count(*) from public.vault_items where user_id = '10000000-0000-4000-8000-000000000001';" \
  | tr -d '[:space:]')"
if [[ "$final_count" != "4" ]]; then
  echo "Concurrent quota test expected 4 records, found $final_count" >&2
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -c "drop function public.test_try_secondary_insert(uuid);"

echo "Secondary Vault quota PostgreSQL tests passed, including concurrent final-slot inserts."
