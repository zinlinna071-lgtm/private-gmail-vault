# Security Test Run Record Contract

**Status:** Signed GitHub webhook receiver, server-only ingestion adapter, PostgreSQL migration harness, and CI verification are implemented. Authoritative GitHub API re-fetch, private-lab event ingestion, and public dashboard integration remain outstanding.  
**Branch:** `feature/vault-authentication`  
**Public exposure:** No webhook feed or public API is exposed.  
**Production impact:** None.

## Purpose

The public Security Operations page must never infer live activity from animation, planned test cases, placeholder records, or unverified client input. Every future public record must be tied to real evidence, sanitized, reviewed, and explicitly approved.

Implementation:
- `lib/security-research/test-run.ts`
- `tests/security-research-test-run.test.ts`
- `lib/security-research/github-webhook.ts`
- `tests/github-webhook.test.ts`
- `lib/security-research/github-webhook-store.ts`
- `tests/github-webhook-store.test.ts`
- `app/api/webhooks/github/route.ts`
- `supabase/migrations/202611070001_github_webhook_ingestion.sql`
- `supabase/tests/github_webhook_ingestion.sql`
- `scripts/test-github-webhook-migration.sh`

## Required provenance

Every publishable record must identify:
- Stable run ID and category.
- Execution source (`GITHUB_ACTIONS` or `PRIVATE_LAB`).
- Repository and exact 40-character commit SHA.
- Runtime/environment and explicit test scope.
- Start and completion timestamps.
- HTTPS evidence URL and human-readable evidence label.
- Bounded public summary and explicit limitations.

The metadata schema validates shape and lifecycle consistency. It does **not** by itself authenticate a GitHub Actions run, verify a private-lab signature, prove evidence URL contents, or prove that the described test actually executed.

## GitHub Actions webhook trust boundary

The repository is private. A public page cannot safely fetch its workflow history anonymously, and a private repository read token must never be exposed to browser code. The event path is a GitHub webhook delivered to a server-only endpoint.

### Implemented receiver

The server route is `POST /api/webhooks/github`. It is deliberately disabled unless `GITHUB_WEBHOOK_INGESTION_ENABLED=true` is configured in a server environment. It also requires a server-only `GITHUB_WEBHOOK_SECRET` of at least 32 characters.

When enabled, the route:
1. Accepts only `X-GitHub-Event: workflow_run` and JSON content.
2. Reads the raw request body incrementally with a 256 KiB limit.
3. Verifies `X-Hub-Signature-256` against the exact raw body using HMAC-SHA256 before JSON parsing.
4. Validates the delivery UUID and strict repository/workflow/feature-branch/run metadata.
5. Persists only a SHA-256 fingerprint and allowlisted metadata through the server-only adapter and service-role RPC.
6. Returns generic no-store responses and does not expose a public feed or log raw payloads/provider errors.

The parser requires the exact repository, allowlisted `.github/workflows/ci.yml` workflow, a feature branch, a 40-character commit SHA, valid timestamps, canonical GitHub run URL, and action/status/conclusion consistency. It rejects unknown conclusions and excludes raw payloads, logs, environment variables, and secret material from its projection.

A valid HMAC proves that the payload was signed by a party holding the webhook secret. It does **not** independently establish current canonical GitHub run/job state, prove that a security test was adequate, or make a passing CI workflow a penetration test.

### Durable storage and database permissions

The migration defines:
- A unique `delivery_id` ledger with a SHA-256 fingerprint of the exact raw body.
- Same-ID/same-hash duplicate handling (`DUPLICATE`) and same-ID/different-hash conflict handling (`DELIVERY_ID_CONFLICT`).
- A private workflow-run table keyed by `run_id + run_attempt`.
- A transactional RPC that advances run metadata only when the incoming timestamp/status rank is newer.
- RLS enabled, no direct table privileges for `anon` or `authenticated`, and RPC execution granted only to `service_role`.
- A default `PRIVATE` publication state; webhook ingestion cannot approve a public record.

The adapter computes the raw-body SHA-256 fingerprint, sends only the fingerprint and allowlisted event metadata to the RPC, validates the RPC result, and replaces provider/database errors with a generic server-side error.

### Verification and current activation state

GitHub Actions runs the migration harness against a disposable PostgreSQL 16 service. It applies the migration and checks:
- Fresh migration application.
- First delivery returns `APPLIED`.
- Same delivery ID and same fingerprint returns `DUPLICATE`.
- Same delivery ID with a different fingerprint returns `DELIVERY_ID_CONFLICT`.
- An older `in_progress` event cannot roll a completed run back and returns `STALE`.
- `anon` and `authenticated` have no direct table privileges (SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, or TRIGGER) and cannot execute the ingestion RPC.
- `service_role` has expected table access and RPC execution.
- Two concurrent sessions submitting the same delivery produce exactly one `APPLIED` and one `DUPLICATE`, with one stored delivery and one run row.

The PostgreSQL 16 harness passed on commit `a1dbc57e6df0debde871f41ac893312605259fd5` (GitHub Actions run `42302994860` and PR run `42303001122`). The subsequent privilege-test expansion and documentation correction are newer commits and require their own CI result before being called verified.

This is disposable CI PostgreSQL evidence, **not** a hosted Supabase test. The migration has not been applied to any hosted Supabase project. No real GitHub webhook has been received because no webhook secret or repository webhook is configured. Neither `GITHUB_WEBHOOK_INGESTION_ENABLED` nor `GITHUB_WEBHOOK_SECRET` is configured in Vercel or another live environment.

### Required before enabling real ingestion

1. Obtain explicit owner approval to apply the reviewed migration to a hosted Supabase project. Do not apply it to production without separate approval.
2. Generate and configure a high-entropy webhook secret in server-side environment configuration only.
3. Register the repository webhook with the exact endpoint and event configuration.
4. Implement authoritative GitHub run/job API re-fetch and compare repository, workflow, run attempt, branch, SHA, status, and conclusion before treating the event as canonical. A private repository requires a server-only credential; never expose it to the browser.
5. Keep publication state private until technical, privacy, and security review plus owner approval.
6. Never expose a GitHub private-repository token or webhook secret to the client.

## Lifecycle and publication

Run states:
- `QUEUED`
- `RUNNING`
- `COMPLETED`
- `FAILED`
- `BLOCKED`
- `NEEDS_REVIEW`

Completed outcomes:
- `PASS`
- `FAIL`
- `BLOCKED`
- `NOT_RUN`

Publication states:
- `PRIVATE`
- `PENDING_REVIEW`
- `APPROVED`
- `WITHDRAWN`

The public projection helper returns a record only when it is terminal, has a completion timestamp, passes strict schema validation, is marked sanitized, and is explicitly `APPROVED`. All other records remain unavailable to the public projection.

## Data minimization

The schema is strict and rejects unknown fields. It has no fields for passwords, tokens, cookies, key material, raw request/response bodies, stack traces, or raw logs. Public summaries and limitations are bounded in length. This is a structural guard, not a complete secret scanner: a trusted publisher must still redact and review content before approval.

## Honest dashboard behavior

The public dashboard must continue to show only individually verified historical CI evidence already linked on the page. Do not display a live run feed or fabricate queued/running/completed events or counters. Show an explicit empty state when there are no active or approved records. Any conceptual animation must remain labeled as illustrative and disconnected from telemetry.

Once the ingestion layer, authoritative verification, and publication workflow are complete, dashboard motion may be driven only by verified state transitions. A run must retain its run ID, commit, environment, scope, timestamps, evidence, and limitations throughout its lifecycle.

## Outstanding work

1. Obtain approval and perform a hosted Supabase migration in a controlled non-production environment.
2. Configure and validate the server-only GitHub webhook secret and register the repository webhook after approval.
3. Add authoritative GitHub run/job API re-fetch and metadata comparison before persisting a run as canonical.
4. Design a signed or otherwise authenticated event source for private-lab runs.
5. Implement a read-only public projection that exposes approved sanitized records only.
6. Add tests for provider mismatch, forged events, revoked publication, and secret-redaction review.
7. Connect the public dashboard only after ingestion and publication gates are verified.

No live event feed, private lab runner, public API, hosted database table, webhook configuration, or deployment has been created. The endpoint remains disabled by default, and the proposed migration remains unapplied to hosted Supabase.
