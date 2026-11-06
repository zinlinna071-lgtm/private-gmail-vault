-- GitHub workflow webhook ingestion ledger.
-- Apply only after explicit owner approval; never apply to production by default.
-- Raw webhook payloads, signatures, secrets, and CI tokens are never persisted.

create table if not exists public.github_webhook_deliveries (
  delivery_id uuid primary key,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  event_name text not null check (event_name = 'workflow_run'),
  action text not null check (action in ('requested', 'in_progress', 'completed')),
  run_id bigint not null check (run_id > 0),
  run_attempt integer not null check (run_attempt > 0),
  received_at timestamptz not null default now(),
  processing_result text not null default 'RECEIVED'
    check (processing_result in ('RECEIVED', 'APPLIED', 'STALE'))
);

create index if not exists github_webhook_deliveries_received_idx
  on public.github_webhook_deliveries (received_at desc);

create table if not exists public.github_workflow_runs (
  run_id bigint not null check (run_id > 0),
  run_attempt integer not null check (run_attempt > 0),
  repository text not null check (repository = 'zinlinna071-lgtm/private-gmail-vault'),
  workflow_path text not null check (workflow_path = '.github/workflows/ci.yml'),
  workflow_id bigint not null check (workflow_id > 0),
  head_branch text not null check (head_branch ~ '^feature/[A-Za-z0-9._/-]{1,80}$'),
  head_sha text not null check (head_sha ~ '^[a-f0-9]{40}$'),
  status text not null check (status in ('queued', 'in_progress', 'completed')),
  conclusion text check (conclusion in (
    'success', 'failure', 'neutral', 'cancelled', 'skipped',
    'timed_out', 'action_required', 'stale', 'startup_failure'
  )),
  created_at timestamptz not null,
  run_started_at timestamptz,
  updated_at timestamptz not null,
  html_url text not null,
  authoritative_verified_at timestamptz not null,
  verified_job_count integer not null check (verified_job_count between 1 and 100),
  verified_jobs_sha256 text not null check (verified_jobs_sha256 ~ '^[a-f0-9]{64}$'),
  last_delivery_id uuid not null references public.github_webhook_deliveries(delivery_id),
  publication_state text not null default 'PRIVATE'
    check (publication_state in ('PRIVATE', 'PENDING_REVIEW', 'APPROVED', 'WITHDRAWN')),
  primary key (run_id, run_attempt),
  check (
    (status = 'completed' and conclusion is not null)
    or (status <> 'completed' and conclusion is null)
  ),
  check (updated_at >= created_at),
  check (run_started_at is null or (run_started_at >= created_at and run_started_at <= updated_at)),
  check (html_url = ('https://github.com/' || repository || '/actions/runs/' || run_id::text))
);

create index if not exists github_workflow_runs_updated_idx
  on public.github_workflow_runs (updated_at desc);

alter table public.github_webhook_deliveries enable row level security;
alter table public.github_workflow_runs enable row level security;
revoke all on table public.github_webhook_deliveries from anon, authenticated;
revoke all on table public.github_workflow_runs from anon, authenticated;
grant all on table public.github_webhook_deliveries to service_role;
grant all on table public.github_workflow_runs to service_role;

create or replace function public.ingest_github_workflow_event(
  p_delivery_id uuid,
  p_payload_sha256 text,
  p_action text,
  p_repository text,
  p_workflow_path text,
  p_workflow_id bigint,
  p_run_id bigint,
  p_run_attempt integer,
  p_head_branch text,
  p_head_sha text,
  p_status text,
  p_conclusion text,
  p_created_at timestamptz,
  p_run_started_at timestamptz,
  p_updated_at timestamptz,
  p_html_url text,
  p_authoritative_verified_at timestamptz,
  p_verified_job_count integer,
  p_verified_jobs_sha256 text
) returns text
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_existing_hash text;
  v_rows integer;
begin
  if p_delivery_id is null
     or p_payload_sha256 is null or p_payload_sha256 !~ '^[a-f0-9]{64}$'
     or p_action is null or p_action not in ('requested', 'in_progress', 'completed')
     or p_repository is distinct from 'zinlinna071-lgtm/private-gmail-vault'
     or p_workflow_path is distinct from '.github/workflows/ci.yml'
     or p_workflow_id is null or p_workflow_id <= 0
     or p_run_id is null or p_run_id <= 0
     or p_run_attempt is null or p_run_attempt <= 0
     or p_head_branch is null or p_head_branch !~ '^feature/[A-Za-z0-9._/-]{1,80}$'
     or p_head_sha is null or p_head_sha !~ '^[a-f0-9]{40}$'
     or p_status is null or p_status not in ('queued', 'in_progress', 'completed')
     or p_created_at is null or p_updated_at is null or p_updated_at < p_created_at
     or (p_run_started_at is not null and
         (p_run_started_at < p_created_at or p_run_started_at > p_updated_at))
     or p_html_url is distinct from ('https://github.com/' || p_repository || '/actions/runs/' || p_run_id::text)
     or p_authoritative_verified_at is null
     or p_verified_job_count is null or p_verified_job_count < 1 or p_verified_job_count > 100
     or p_verified_jobs_sha256 is null or p_verified_jobs_sha256 !~ '^[a-f0-9]{64}$'
     or (p_action = 'requested' and p_status <> 'queued')
     or (p_action = 'in_progress' and p_status <> 'in_progress')
     or (p_action = 'completed' and p_status <> 'completed')
     or (p_status = 'completed' and (p_conclusion is null or p_conclusion not in (
       'success', 'failure', 'neutral', 'cancelled', 'skipped',
       'timed_out', 'action_required', 'stale', 'startup_failure'
     )))
     or (p_status <> 'completed' and p_conclusion is not null) then
    raise exception 'Invalid verified workflow event';
  end if;

  insert into public.github_webhook_deliveries (
    delivery_id, payload_sha256, event_name, action, run_id, run_attempt
  ) values (
    p_delivery_id, p_payload_sha256, 'workflow_run', p_action, p_run_id, p_run_attempt
  ) on conflict (delivery_id) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    select payload_sha256 into v_existing_hash
    from public.github_webhook_deliveries where delivery_id = p_delivery_id;
    if v_existing_hash = p_payload_sha256 then return 'DUPLICATE'; end if;
    return 'DELIVERY_ID_CONFLICT';
  end if;

  insert into public.github_workflow_runs (
    run_id, run_attempt, repository, workflow_path, workflow_id, head_branch, head_sha,
    status, conclusion, created_at, run_started_at, updated_at, html_url,
    authoritative_verified_at, verified_job_count, verified_jobs_sha256, last_delivery_id
  ) values (
    p_run_id, p_run_attempt, p_repository, p_workflow_path, p_workflow_id, p_head_branch,
    p_head_sha, p_status, p_conclusion, p_created_at, p_run_started_at, p_updated_at,
    p_html_url, p_authoritative_verified_at, p_verified_job_count, p_verified_jobs_sha256,
    p_delivery_id
  )
  on conflict (run_id, run_attempt) do update set
    repository = excluded.repository,
    workflow_path = excluded.workflow_path,
    workflow_id = excluded.workflow_id,
    head_branch = excluded.head_branch,
    head_sha = excluded.head_sha,
    status = excluded.status,
    conclusion = excluded.conclusion,
    created_at = excluded.created_at,
    run_started_at = excluded.run_started_at,
    updated_at = excluded.updated_at,
    html_url = excluded.html_url,
    authoritative_verified_at = excluded.authoritative_verified_at,
    verified_job_count = excluded.verified_job_count,
    verified_jobs_sha256 = excluded.verified_jobs_sha256,
    last_delivery_id = excluded.last_delivery_id
  where
    (excluded.updated_at, case excluded.status
      when 'queued' then 1 when 'in_progress' then 2 when 'completed' then 3 end)
    >
    (public.github_workflow_runs.updated_at, case public.github_workflow_runs.status
      when 'queued' then 1 when 'in_progress' then 2 when 'completed' then 3 end);

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    update public.github_webhook_deliveries set processing_result = 'STALE'
    where delivery_id = p_delivery_id;
    return 'STALE';
  end if;

  update public.github_webhook_deliveries set processing_result = 'APPLIED'
  where delivery_id = p_delivery_id;
  return 'APPLIED';
end;
$$;

revoke all on function public.ingest_github_workflow_event(
  uuid, text, text, text, text, bigint, bigint, integer, text, text, text, text,
  timestamptz, timestamptz, timestamptz, text, timestamptz, integer, text
) from public, anon, authenticated;
grant execute on function public.ingest_github_workflow_event(
  uuid, text, text, text, text, bigint, bigint, integer, text, text, text, text,
  timestamptz, timestamptz, timestamptz, text, timestamptz, integer, text
) to service_role;

comment on table public.github_webhook_deliveries is
  'Minimal webhook idempotency ledger. Raw payloads and signature secrets are never stored.';
comment on table public.github_workflow_runs is
  'Private GitHub Actions metadata with canonical run/job verification evidence. Public visibility requires separate sanitization and owner approval.';
