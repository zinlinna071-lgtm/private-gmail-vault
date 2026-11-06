# Security Test Run Record Contract

**Status:** Metadata contract and GitHub webhook verification primitives implemented; durable ingestion and dashboard integration are not implemented.  
**Branch:** `feature/vault-authentication`  
**Public exposure:** None added by this contract.  
**Production impact:** None.

## Purpose

The public Security Operations page must never infer live activity from animation, planned test cases, placeholder records, or unverified client input. This contract defines the minimum metadata shape and trust boundaries for a future test-run ingestion pipeline.

Implementation:
- `lib/security-research/test-run.ts`
- `tests/security-research-test-run.test.ts`
- `lib/security-research/github-webhook.ts`
- `tests/github-webhook.test.ts`

## Required provenance

Every record must identify:
- A stable run ID and category.
- The execution source (`GITHUB_ACTIONS` or `PRIVATE_LAB`).
- Repository and exact 40-character commit SHA.
- Runtime/environment and explicit test scope.
- Start and completion timestamps.
- An HTTPS evidence URL and human-readable evidence label.
- A bounded public summary and explicit limitations.

The metadata schema validates shape and lifecycle consistency. It does **not** authenticate a GitHub Actions run, verify a private-lab signature, prove evidence URL contents, or prove that the described test actually executed.

## GitHub Actions webhook trust boundary

The repository is private. A public page cannot safely fetch its workflow history anonymously, and a private repository read token must never be exposed to browser code. The planned event path is therefore a GitHub webhook delivered to a server-only endpoint.

Implemented primitives:
- Verify `X-Hub-Signature-256` against the exact raw request body using HMAC-SHA256 before JSON parsing.
- Read request bodies incrementally with a 256 KiB byte cap; reject oversized or malformed UTF-8 bodies before JSON parsing.
- Reject missing/malformed signatures, weak secrets, and bodies larger than 256 KiB.
- Extract only a small metadata projection from the signed `workflow_run` event.
- Require a UUID-shaped delivery ID, the exact repository, the allowlisted `.github/workflows/ci.yml` workflow, a feature branch, a 40-character commit SHA, valid UTC timestamps, a canonical GitHub run URL without credentials/query/fragment, and action/status consistency.
- Validate the nested run repository when supplied; reject malformed nested repository values.
- Exclude raw payloads, logs, environment variables, and secret material from the projection.

A proposed Supabase migration is committed at `supabase/migrations/202611070001_github_webhook_ingestion.sql`. It defines:
- A unique `delivery_id` ledger with a SHA-256 fingerprint of the exact raw body; same-ID/same-hash deliveries return `DUPLICATE`, while same-ID/different-hash deliveries return `DELIVERY_ID_CONFLICT`.
- A private workflow-run table keyed by `run_id + run_attempt`.
- A single transactional RPC that claims a delivery and advances run metadata only when the incoming timestamp/status rank is newer, preventing an older event from rolling state backwards.
- RLS enabled, no `anon` or `authenticated` table access, and RPC execution granted only to `service_role`.
- A default `PRIVATE` publication state; webhook ingestion cannot approve a public record.

A server-only adapter is also committed at `lib/security-research/github-webhook-store.ts`. It computes a SHA-256 fingerprint of the exact raw body, sends only the fingerprint and allowlisted event metadata to the RPC, validates the RPC result, and replaces provider/database errors with a generic server-side error. Its unit tests are in `tests/github-webhook-store.test.ts`.

The adapter is not called by any route. The migration has received source-level review only. It has **not** been applied to any Supabase project or tested against a live/isolated PostgreSQL instance. Therefore, durable replay protection is designed in the migration but is not active yet. A valid HMAC proves that the payload was signed by a party holding the webhook secret; it does not prove that a security test was adequate or that a passing CI workflow constitutes a penetration test.

Required before endpoint activation:
1. Review and test the proposed migration in an isolated PostgreSQL/Supabase project; do not apply it to production.
2. Configure a high-entropy webhook secret in server-side environment configuration only.
3. Implement the endpoint that checks `X-GitHub-Event`, reads the bounded raw body, verifies HMAC, parses the event, and then calls the server-only adapter.
4. Verify event fields against GitHub's authoritative run/job API where required.
5. Keep the publication state private/pending until the owner completes technical, privacy, and security review.
6. Never expose a GitHub private-repository token or webhook secret to the client.

No webhook endpoint, webhook secret, private-repository token, live database table, or GitHub webhook configuration has been created. The migration file is only a proposed schema change in the feature branch; it must not be applied until owner approval and isolated PostgreSQL migration/transaction tests are complete. Do not enable or publish the feed until these dependencies are explicitly configured and tested.

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

The schema is strict and rejects unknown fields. It has no fields for passwords, tokens, cookies, key material, raw request/response bodies, stack traces, or raw logs. Public summaries and limitations are bounded in length. This is a structural guard, not a complete secret scanner: the trusted publisher must still redact and review content before approval.

## Honest dashboard behavior

Until a trusted ingestion adapter and persistent source of truth exist:
- Do not display a live run feed.
- Do not fabricate queued/running/completed events or counters.
- Continue showing only individually verified historical CI evidence already linked on the public page.
- Show an explicit empty state when there are no active or approved records.
- Any conceptual animation must remain labeled as illustrative and disconnected from telemetry.

When the ingestion layer is added, dashboard motion may be driven only by verified state transitions. A run must retain its run ID, commit, environment, scope, timestamps, evidence, and limitations throughout its lifecycle.

## Outstanding work

1. Review and test the proposed migration in an isolated PostgreSQL/Supabase project; do not apply it to production.
2. Configure and validate a server-only GitHub webhook secret.
3. Implement a server-only endpoint that verifies the event header, bounded raw body, HMAC, and delivery metadata before calling the atomic ingestion RPC.
4. Add database-backed replay protection, idempotency, and out-of-order transition tests.
4. Verify CI run/job metadata against GitHub's authoritative API.
5. Design a signed or otherwise authenticated event source for private-lab runs.
6. Implement a read-only public projection that exposes approved sanitized records only.
7. Add tests for provider mismatch, forged events, duplicate events, out-of-order transitions, revoked publication, and secret-redaction review.
8. Connect the public dashboard only after the ingestion and publication gates are verified.

No live event feed, private lab runner, public API, live database table, webhook configuration, or deployment was created as part of this contract. The proposed migration remains unapplied and unverified against PostgreSQL.


## Isolated PostgreSQL migration test harness

A disposable PostgreSQL 16 service has been added to the GitHub Actions CI job. The workflow runs `scripts/test-github-webhook-migration.sh`, which creates only local test roles in that ephemeral database, applies the proposed migration, and executes `supabase/tests/github_webhook_ingestion.sql`.

The database assertions cover:
- Fresh migration application.
- First delivery returns `APPLIED`.
- Same delivery ID and same fingerprint returns `DUPLICATE`.
- Same delivery ID with a different fingerprint returns `DELIVERY_ID_CONFLICT`.
- An older `in_progress` event cannot roll a completed run back and returns `STALE`.
- `anon` and `authenticated` cannot read either table or execute the ingestion RPC; `service_role` has the intended grants.
- Two concurrent sessions submitting the same delivery produce exactly one `APPLIED` and one `DUPLICATE`, with one stored delivery and one run row.

The harness uses a disposable GitHub Actions PostgreSQL service only. It does not connect to Supabase, use production credentials, configure a webhook, or publish run data. These checks establish behavior for the tested PostgreSQL migration in CI; they do not establish that a hosted Supabase project has been configured or that production deployment is approved.

**Verification status:** the harness and CI workflow have been committed, but their first CI execution must pass before these database behaviors are described as verified.


## Disabled-by-default GitHub webhook endpoint

The server route `POST /api/webhooks/github` now exists, but it is deliberately inert unless `GITHUB_WEBHOOK_INGESTION_ENABLED=true` is set in a server environment. It also requires a server-only `GITHUB_WEBHOOK_SECRET` of at least 32 characters. Neither variable is configured in Vercel or any live environment.

When enabled by a future explicit operator action, the route:
1. Accepts only `X-GitHub-Event: workflow_run` and JSON content.
2. Reads the request body with the 256 KiB streaming limit.
3. Verifies `X-Hub-Signature-256` against the exact raw body before JSON parsing.
4. Validates the delivery UUID and strict repository/workflow/feature-branch/run metadata.
5. Persists only the SHA-256 body fingerprint and allowlisted metadata through the service-role RPC.
6. Returns generic no-store responses; it does not expose a public feed or log raw payloads/provider errors.

The route maps duplicate, stale, and delivery-ID conflict outcomes without publishing records. Unknown GitHub conclusions are rejected by the parser to match the database allowlist.

Route tests use synthetic signed payloads and mocked persistence. They verify disabled-by-default behavior, missing/weak secret handling, invalid signature rejection, event/content-type restrictions, payload validation, generic error handling, and idempotency response mapping. These tests do not represent live GitHub deliveries.

**Activation remains prohibited until separately approved:** no webhook secret has been generated or configured, no GitHub repository webhook has been registered, no Supabase migration has been applied to a hosted project, and no public event projection is implemented.
