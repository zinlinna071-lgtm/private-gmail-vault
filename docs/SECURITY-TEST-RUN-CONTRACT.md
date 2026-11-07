# Security Test Run Record Contract

**Status:** Signed GitHub webhook receiver, server-only GitHub API verifier, ingestion adapter, and PostgreSQL migration harness are implemented on the feature branch. The exact current implementation at commit `e6339738b07c834cc8d1e7fb9986f047dfd6b1dc` passed GitHub Actions CI run `42313273497`, including automated tests, type check, PostgreSQL 16 migration tests, dependency security audit, and production build. Hosted Supabase activation, real webhook delivery, private-lab ingestion, and public dashboard integration remain disabled/not implemented. Vercel Preview creation was blocked by the team's daily deployment API limit; no Preview URL exists for this commit yet.  
**Branch:** `feature/vault-authentication`  
**Public exposure:** No webhook feed or public API is exposed.  
**Production impact:** None.

## Purpose

The public Security Operations page must never infer live activity from animation, planned test cases, placeholder records, or unverified client input. Every future public record must be tied to real evidence, sanitized, reviewed, and explicitly approved.

Implementation:
- `lib/security-research/test-run.ts`
- `lib/security-research/github-webhook.ts`
- `lib/security-research/github-api-verification.ts`
- `lib/security-research/github-webhook-store.ts`
- `app/api/webhooks/github/route.ts`
- `supabase/migrations/202611070001_github_webhook_ingestion.sql`
- `supabase/tests/github_webhook_ingestion.sql`
- `scripts/test-github-webhook-migration.sh`
- Related tests: `tests/github-webhook.test.ts`, `tests/github-api-verification.test.ts`, `tests/github-webhook-route.test.ts`, `tests/github-webhook-store.test.ts`

## Required provenance

Every publishable record must identify:
- Stable run ID and category.
- Execution source (`GITHUB_ACTIONS` or `PRIVATE_LAB`).
- Repository and exact 40-character commit SHA.
- Runtime/environment and explicit test scope.
- Start and completion timestamps.
- HTTPS evidence URL and human-readable evidence label.
- Bounded public summary and explicit limitations.

The metadata schema validates shape and lifecycle consistency. It does not by itself authenticate a GitHub Actions run, verify a private-lab signature, prove evidence URL contents, or prove that the described test actually executed.

## GitHub Actions webhook trust boundary

The repository is private. A public page cannot safely fetch its workflow history anonymously, and a private repository read token must never be exposed to browser code. The event path is a GitHub webhook delivered to a server-only endpoint.

### Signed webhook receiver

The server route is `POST /api/webhooks/github`. It is deliberately disabled unless `GITHUB_WEBHOOK_INGESTION_ENABLED=true` is configured in a server environment. It also requires a server-only `GITHUB_WEBHOOK_SECRET` of at least 32 characters.

When enabled, the route:
1. Accepts only `X-GitHub-Event: workflow_run` and JSON content.
2. Reads the raw request body incrementally with a 256 KiB limit.
3. Verifies `X-Hub-Signature-256` against the exact raw body using HMAC-SHA256 before JSON parsing.
4. Validates the delivery UUID and strict repository/workflow/feature-branch/run metadata, including workflow ID.
5. Calls the authoritative GitHub API verifier; no persistence occurs if verification fails.
6. Persists only a SHA-256 fingerprint, allowlisted event metadata, and bounded canonical verification evidence.
7. Returns generic no-store responses and does not expose a public feed or log raw payloads/provider errors.

A valid HMAC proves that the payload was signed by a party holding the webhook secret. It does not independently establish current canonical GitHub run/job state, prove that a security test was adequate, or make a passing CI workflow a penetration test.

### Authoritative GitHub run and job verification

`lib/security-research/github-api-verification.ts` re-fetches three fixed GitHub API resources using HTTPS and a server-only `GITHUB_API_TOKEN`:
- The exact workflow run by run ID.
- The exact workflow by workflow ID.
- The jobs for the exact run attempt.

It compares repository identity, run ID, workflow ID/path, attempt, branch, commit SHA, status, conclusion, creation/update timestamps, and canonical HTML URL against the signed event. It validates each returned job's run ID/attempt/status and requires all jobs to be completed when the run is completed. The job response must be complete within the configured 100-job cap; incomplete/paginated results fail closed. A queued run may legitimately have zero jobs before GitHub schedules them; in-progress and completed runs must include at least one job. A SHA-256 digest of the sorted, normalized job metadata and its count are retained with a verification timestamp.

The API token must be a fine-grained, server-only token with `Actions: read` and repository metadata read access, limited to this repository. It must never use a `NEXT_PUBLIC_` variable, enter browser code, or be written to logs or the database. Missing credentials, API errors, redirects, mismatched metadata, or incomplete jobs prevent ingestion.

This is an authoritative snapshot at webhook processing time. It does not prove the correctness or security quality of the CI tests themselves.

### Durable storage and database permissions

The proposed migration defines:
- A unique `delivery_id` ledger with a SHA-256 fingerprint of the exact raw body.
- Same-ID/same-hash duplicate handling (`DUPLICATE`) and same-ID/different-hash conflict handling (`DELIVERY_ID_CONFLICT`).
- A private workflow-run table keyed by `run_id + run_attempt`.
- Workflow ID/path and canonical verification timestamp, job count (0–100; queued runs may have no jobs yet), and job metadata digest.
- A transactional RPC that advances run metadata only when the incoming timestamp/status rank is newer.
- RLS enabled, no direct table privileges for `anon` or `authenticated`, and RPC execution granted only to `service_role`.
- A default `PRIVATE` publication state; webhook ingestion cannot approve a public record.

The adapter computes the raw-body SHA-256 fingerprint, sends only the fingerprint, allowlisted event metadata, and canonical verification summary to the RPC. It never persists the raw body, HMAC signature, API token, or secret material.

### Verification and activation state

The PostgreSQL migration harness runs against a disposable PostgreSQL 16 service in GitHub Actions. It checks fresh migration application, idempotent and conflicting deliveries, stale event ordering, concurrent duplicate delivery, and role privileges. The updated SQL fixtures now also assert workflow ID and persisted canonical job-verification metadata.

The current schema and expanded tests passed the PostgreSQL 16 harness in GitHub Actions run `42313273497` for exact branch commit `e6339738b07c834cc8d1e7fb9986f047dfd6b1dc`. This is disposable CI PostgreSQL evidence, not a hosted Supabase test.

This is disposable CI PostgreSQL evidence, not a hosted Supabase test. The migration has not been applied to any hosted Supabase project. No real GitHub webhook has been received. No webhook secret, API token, or repository webhook is configured in Vercel or another live environment. `GITHUB_WEBHOOK_INGESTION_ENABLED` remains false in `.env.example`.

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

The schema is strict and rejects unknown fields. It has no fields for passwords, tokens, cookies, key material, raw request/response bodies, stack traces, or raw logs. The job digest is a hash of allowlisted normalized metadata, not raw logs or artifacts. Public summaries and limitations are bounded in length. This is a structural guard, not a complete secret scanner: a trusted publisher must still redact and review content before approval.

## Honest dashboard behavior

The public dashboard must continue to show only individually verified historical CI evidence already linked on the page. Do not display a live run feed or fabricate queued/running/completed events or counters. Show an explicit empty state when there are no active or approved records. Any conceptual animation must remain labeled as illustrative and disconnected from telemetry.

Dashboard motion may be driven only by verified state transitions after the ingestion layer and publication workflow are complete. A run must retain its run ID, commit, environment, scope, timestamps, evidence, and limitations throughout its lifecycle.

## Outstanding work

1. Obtain explicit owner approval before applying the migration to a hosted non-production Supabase project.
2. Generate/configure the server-only webhook secret and least-privilege GitHub API token; register the repository webhook only after approval.
3. Verify an actual signed GitHub webhook end-to-end in a controlled environment.
4. Design a signed or otherwise authenticated event source for private-lab runs.
5. Implement a read-only public projection that exposes approved sanitized records only.
6. Add tests for token permission failures, provider mismatch, forged events, revoked publication, and secret-redaction review.
7. Connect the public dashboard only after ingestion and publication gates are verified.
8. Create and inspect the Vercel Preview for the verified commit after the deployment API limit resets; do not deploy to Production.

No live event feed, private lab runner, public API, hosted database table, webhook configuration, or deployment has been created. The endpoint remains disabled by default, and the proposed migration remains unapplied to hosted Supabase.
