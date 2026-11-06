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

The verifier does not itself provide delivery replay protection, persistence, event ordering, owner approval, or public publication. A valid HMAC proves that the payload was signed by a party holding the webhook secret; it does not prove that a security test was adequate or that a passing CI workflow constitutes a penetration test.

Required before endpoint activation:
1. Configure a high-entropy webhook secret in server-side environment configuration only.
2. Add durable storage for delivery IDs and run records; reject duplicate delivery IDs and enforce idempotency on repository + run ID + attempt.
3. Enforce legal state transitions and retain an append-only audit trail.
4. Verify event fields against GitHub's authoritative run/job API where required.
5. Keep the publication state private/pending until the owner completes technical, privacy, and security review.
6. Never expose a GitHub private-repository token or webhook secret to the client.

No webhook endpoint, webhook secret, private-repository token, database table, or GitHub webhook configuration has been created. Do not enable or publish the feed until these dependencies are explicitly configured and tested.

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

1. Configure and validate a server-only GitHub webhook secret.
2. Implement an authenticated endpoint with raw-body signature verification, replay protection, idempotency, and rate/size limits.
3. Add durable append-only event storage and out-of-order transition handling.
4. Verify CI run/job metadata against GitHub's authoritative API.
5. Design a signed or otherwise authenticated event source for private-lab runs.
6. Implement a read-only public projection that exposes approved sanitized records only.
7. Add tests for provider mismatch, forged events, duplicate events, out-of-order transitions, revoked publication, and secret-redaction review.
8. Connect the public dashboard only after the ingestion and publication gates are verified.

No live event feed, private lab runner, public API, database table, webhook configuration, or deployment was created as part of this contract.
