#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must point to a disposable PostgreSQL database}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT_DIR/supabase/migrations/202611070001_github_webhook_ingestion.sql"
SQL_TEST="$ROOT_DIR/supabase/tests/github_webhook_ingestion.sql"

# The CI service is disposable. These Supabase-compatible roles are created
# only in that isolated database; this script must never target production.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$roles$;
SQL

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL_TEST"

# Race two independent database sessions with the exact same delivery. The
# unique delivery key + transaction must yield one APPLIED and one DUPLICATE.
delivery_id="9f3c1d20-8b7a-4e61-9c52-000000000001"
payload_hash="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
common="select public.ingest_github_workflow_event(
  '$delivery_id', '$payload_hash', 'requested',
  'zinlinna071-lgtm/private-gmail-vault', '.github/workflows/ci.yml',
  990000001, 1, 'feature/postgres-test', repeat('a', 40), 'queued', null,
  '2026-11-07T00:00:00Z', null, '2026-11-07T00:00:00Z',
  'https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/990000001'
);"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "$common" > "$tmp_dir/one" &
pid_one=$!
psql "$DATABASE_URL" -X -A -t -v ON_ERROR_STOP=1 -c "$common" > "$tmp_dir/two" &
pid_two=$!
wait "$pid_one"
wait "$pid_two"

results="$(cat "$tmp_dir/one" "$tmp_dir/two" | sed '/^[[:space:]]*$/d' | sort | tr '\n' ' ')"
if [[ "$results" != "APPLIED DUPLICATE " ]]; then
  echo "Concurrent idempotency test failed: $results" >&2
  exit 1
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DO $assert$
BEGIN
  IF (SELECT count(*) FROM public.github_webhook_deliveries
      WHERE delivery_id = '9f3c1d20-8b7a-4e61-9c52-000000000001') <> 1 THEN
    RAISE EXCEPTION 'Concurrent duplicate created more than one delivery row';
  END IF;
  IF (SELECT count(*) FROM public.github_workflow_runs
      WHERE run_id = 990000001 AND run_attempt = 1) <> 1 THEN
    RAISE EXCEPTION 'Concurrent duplicate created an unexpected run row';
  END IF;
END
$assert$;

DELETE FROM public.github_workflow_runs WHERE run_id IN (990000001, 990000002);
DELETE FROM public.github_webhook_deliveries
WHERE delivery_id IN (
  '9f3c1d20-8b7a-4e61-9c52-000000000001',
  '9f3c1d20-8b7a-4e61-9c52-000000000002',
  '9f3c1d20-8b7a-4e61-9c52-000000000003'
);
SQL

echo "GitHub webhook migration PostgreSQL tests passed."
