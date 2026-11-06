# Security Test Run Record Contract

**Status:** Schema and publication gate implemented; ingestion and dashboard integration are not implemented.  
**Branch:** `feature/vault-authentication`  
**Public exposure:** None added by this contract.  
**Production impact:** None.

## Purpose

The public Security Operations page must never infer live activity from animation, planned test cases, placeholder records, or unverified client input. This contract defines the minimum metadata shape for a future trusted test-run ingestion pipeline.

Implementation:
- `lib/security-research/test-run.ts`
- `tests/security-research-test-run.test.ts`

## Required provenance

Every record must identify:
- A stable run ID and category.
- The execution source (`GITHUB_ACTIONS` or `PRIVATE_LAB`).
- Repository and exact 40-character commit SHA.
- Runtime/environment and explicit test scope.
- Start and completion timestamps.
- An HTTPS evidence URL and human-readable evidence label.
- A bounded public summary and explicit limitations.

The schema validates metadata shape and lifecycle consistency. It does **not** authenticate a GitHub Actions run, verify a private-lab signature, prove the evidence URL contents, or prove that the described test actually executed. The future ingestion layer must independently retrieve and verify the CI run or validate a trusted private-lab event before constructing a record.

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

1. Verify CI provider run metadata against the exact repository, workflow, branch, commit, conclusion, and run URL.
2. Design a signed or otherwise authenticated event source for private-lab runs.
3. Add a server-only ingestion path with replay protection and idempotent run IDs.
4. Add a persistent append-only audit trail and withdrawal/correction history.
5. Implement a read-only public projection that exposes approved sanitized records only.
6. Add tests for provider mismatch, forged events, duplicate events, out-of-order transitions, revoked publication, and secret-redaction review.
7. Connect the public dashboard only after the ingestion and publication gates are verified.

No live event feed, private lab runner, public API, database table, or deployment was created as part of this contract.
