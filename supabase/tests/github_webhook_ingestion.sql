-- Runs against a disposable PostgreSQL database after the proposed migration.
-- All sequential fixtures are rolled back at the end.
BEGIN;

DO $assert$
DECLARE
  result text;
  run_row public.github_workflow_runs%ROWTYPE;
  function_oid oid;
BEGIN
  result := public.ingest_github_workflow_event(
    '9f3c1d20-8b7a-4e61-9c52-000000000002',
    repeat('b', 64),
    'completed',
    'zinlinna071-lgtm/private-gmail-vault',
    '.github/workflows/ci.yml',
    990000002,
    1,
    'feature/postgres-test',
    repeat('b', 40),
    'completed',
    'success',
    '2026-11-07T00:00:00Z',
    '2026-11-07T00:01:00Z',
    '2026-11-07T00:02:00Z',
    'https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/990000002'
  );
  IF result <> 'APPLIED' THEN
    RAISE EXCEPTION 'Expected APPLIED, got %', result;
  END IF;

  result := public.ingest_github_workflow_event(
    '9f3c1d20-8b7a-4e61-9c52-000000000002',
    repeat('b', 64),
    'completed',
    'zinlinna071-lgtm/private-gmail-vault',
    '.github/workflows/ci.yml',
    990000002,
    1,
    'feature/postgres-test',
    repeat('b', 40),
    'completed',
    'success',
    '2026-11-07T00:00:00Z',
    '2026-11-07T00:01:00Z',
    '2026-11-07T00:02:00Z',
    'https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/990000002'
  );
  IF result <> 'DUPLICATE' THEN
    RAISE EXCEPTION 'Expected DUPLICATE, got %', result;
  END IF;

  result := public.ingest_github_workflow_event(
    '9f3c1d20-8b7a-4e61-9c52-000000000002',
    repeat('c', 64),
    'completed',
    'zinlinna071-lgtm/private-gmail-vault',
    '.github/workflows/ci.yml',
    990000002,
    1,
    'feature/postgres-test',
    repeat('b', 40),
    'completed',
    'success',
    '2026-11-07T00:00:00Z',
    '2026-11-07T00:01:00Z',
    '2026-11-07T00:02:00Z',
    'https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/990000002'
  );
  IF result <> 'DELIVERY_ID_CONFLICT' THEN
    RAISE EXCEPTION 'Expected DELIVERY_ID_CONFLICT, got %', result;
  END IF;

  result := public.ingest_github_workflow_event(
    '9f3c1d20-8b7a-4e61-9c52-000000000003',
    repeat('d', 64),
    'in_progress',
    'zinlinna071-lgtm/private-gmail-vault',
    '.github/workflows/ci.yml',
    990000002,
    1,
    'feature/postgres-test',
    repeat('b', 40),
    'in_progress',
    null,
    '2026-11-07T00:00:00Z',
    '2026-11-07T00:01:00Z',
    '2026-11-07T00:01:30Z',
    'https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/990000002'
  );
  IF result <> 'STALE' THEN
    RAISE EXCEPTION 'Expected STALE for an older event, got %', result;
  END IF;

  SELECT * INTO run_row
  FROM public.github_workflow_runs
  WHERE run_id = 990000002 AND run_attempt = 1;
  IF run_row.status <> 'completed'
     OR run_row.conclusion <> 'success'
     OR run_row.updated_at <> '2026-11-07T00:02:00Z'::timestamptz THEN
    RAISE EXCEPTION 'Stale event rolled back the latest run state';
  END IF;

  -- Public-facing Supabase roles must have no direct table privileges,
  -- not merely no SELECT. RLS is defense in depth, not a substitute for grants.
  IF has_table_privilege('anon', 'public.github_webhook_deliveries', 'SELECT')
     OR has_table_privilege('anon', 'public.github_webhook_deliveries', 'INSERT')
     OR has_table_privilege('anon', 'public.github_webhook_deliveries', 'UPDATE')
     OR has_table_privilege('anon', 'public.github_webhook_deliveries', 'DELETE')
     OR has_table_privilege('anon', 'public.github_webhook_deliveries', 'TRUNCATE')
     OR has_table_privilege('anon', 'public.github_webhook_deliveries', 'REFERENCES')
     OR has_table_privilege('anon', 'public.github_webhook_deliveries', 'TRIGGER')
     OR has_table_privilege('authenticated', 'public.github_webhook_deliveries', 'SELECT')
     OR has_table_privilege('authenticated', 'public.github_webhook_deliveries', 'INSERT')
     OR has_table_privilege('authenticated', 'public.github_webhook_deliveries', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.github_webhook_deliveries', 'DELETE')
     OR has_table_privilege('authenticated', 'public.github_webhook_deliveries', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.github_webhook_deliveries', 'REFERENCES')
     OR has_table_privilege('authenticated', 'public.github_webhook_deliveries', 'TRIGGER')
     OR has_table_privilege('anon', 'public.github_workflow_runs', 'SELECT')
     OR has_table_privilege('anon', 'public.github_workflow_runs', 'INSERT')
     OR has_table_privilege('anon', 'public.github_workflow_runs', 'UPDATE')
     OR has_table_privilege('anon', 'public.github_workflow_runs', 'DELETE')
     OR has_table_privilege('anon', 'public.github_workflow_runs', 'TRUNCATE')
     OR has_table_privilege('anon', 'public.github_workflow_runs', 'REFERENCES')
     OR has_table_privilege('anon', 'public.github_workflow_runs', 'TRIGGER')
     OR has_table_privilege('authenticated', 'public.github_workflow_runs', 'SELECT')
     OR has_table_privilege('authenticated', 'public.github_workflow_runs', 'INSERT')
     OR has_table_privilege('authenticated', 'public.github_workflow_runs', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.github_workflow_runs', 'DELETE')
     OR has_table_privilege('authenticated', 'public.github_workflow_runs', 'TRUNCATE')
     OR has_table_privilege('authenticated', 'public.github_workflow_runs', 'REFERENCES')
     OR has_table_privilege('authenticated', 'public.github_workflow_runs', 'TRIGGER') THEN
    RAISE EXCEPTION 'Public Supabase roles unexpectedly have direct table privileges';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.github_webhook_deliveries', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.github_workflow_runs', 'SELECT') THEN
    RAISE EXCEPTION 'service_role is missing expected table access';
  END IF;

  function_oid := to_regprocedure(
    'public.ingest_github_workflow_event(uuid,text,text,text,text,bigint,integer,text,text,text,text,timestamptz,timestamptz,timestamptz,text)'
  );
  IF function_oid IS NULL
     OR has_function_privilege('anon', function_oid, 'EXECUTE')
     OR has_function_privilege('authenticated', function_oid, 'EXECUTE')
     OR NOT has_function_privilege('service_role', function_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'RPC execute grants do not match the intended service-only boundary';
  END IF;
END
$assert$;

ROLLBACK;
