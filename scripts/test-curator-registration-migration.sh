#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable PostgreSQL database}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT_DIR/supabase/migrations/202611080005_curator_registration_claims.sql"
SQL_TEST="$ROOT_DIR/supabase/tests/curator_registration_claims.sql"

# CI uses a disposable PostgreSQL service. Never point this script at production.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$roles$;
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_TEST"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
race_sql="select case when public.consume_curator_challenge(repeat('6',64), repeat('e',64)) then 'true' else 'false' end;"
psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "$race_sql" > "$tmp_dir/one" &
pid_one=$!
psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "$race_sql" > "$tmp_dir/two" &
pid_two=$!
wait "$pid_one"
wait "$pid_two"

results="$(cat "$tmp_dir/one" "$tmp_dir/two" | sed '/^[[:space:]]*$/d' | sort | tr '\n' ' ')"
if [[ "$results" != "false true " ]]; then
  echo "Concurrent challenge consumption was not one-time: $results" >&2
  exit 1
fi

claim_race_sql="select case when public.consume_curator_registration_claim(repeat('7',64), repeat('f',64)) then 'true' else 'false' end;"
psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "$claim_race_sql" > "$tmp_dir/claim_one" &
claim_pid_one=$!
psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "$claim_race_sql" > "$tmp_dir/claim_two" &
claim_pid_two=$!
wait "$claim_pid_one"
wait "$claim_pid_two"

claim_results="$(cat "$tmp_dir/claim_one" "$tmp_dir/claim_two" | sed '/^[[:space:]]*$/d' | sort | tr '\n' ' ')"
if [[ "$claim_results" != "false true " ]]; then
  echo "Concurrent registration claim consumption was not one-time: $claim_results" >&2
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM public.curator_challenges
WHERE challenge_hash IN (repeat('1',64), repeat('2',64), repeat('3',64), repeat('6',64));
DELETE FROM public.curator_registration_claims
WHERE claim_hash IN (repeat('4',64), repeat('5',64), repeat('7',64));
SQL

echo "Curator challenge/claim PostgreSQL migration tests passed."
