# Private Security Lab — Telemetry and Execution Contract

**Status:** Phase 1 foundation; event contract implemented, execution engine not yet connected.
**Branch:** `feature/vault-authentication`
**Execution:** Owner-authorized workflows only; isolated non-production fixtures.
**Public exposure:** None. The public Security page remains read-only.

## Product boundary

The owner and authorized assistant workflow run bounded tests against this application's isolated test harnesses. The public Security & Transparency page may display only reviewed, sanitized reports derived from those executions. It must never provide a test trigger, payload input, shell, arbitrary URL fetch, or access to private lab routes.

## Real telemetry, not decorative attacks

A moving line, packet, alert, or node state may be animated only while rendering an actual event from a specific test run. Each visual item must be traceable to an event ID and run ID. No event means no activity animation; the idle state must say idle. Explanatory diagrams must be labeled illustrative and visually distinct from live run telemetry.

Initial event types are intentionally limited to:
- `test.started`
- `request.observed`
- `control.allowed`
- `control.blocked`
- `finding.detected`
- `test.completed`

Events carry only bounded metadata: run/event UUIDs, timestamp, source, module, event type, outcome, optional duration and byte counts, synthetic fixture ID, and optional control ID. They must never contain request/response bodies, passwords, OTPs, recovery codes, cookies, tokens, keys, raw database rows, arbitrary metadata, or user-controlled URLs.

## Implemented foundation

- `lib/security-lab/telemetry.ts` defines a strict Zod event schema and bounded batch parser.
- Unknown fields are rejected, including fields named like credentials or request bodies.
- Only explicitly enumerated modules, event types, sources, and outcomes are accepted.
- Every event must identify a synthetic fixture.
- Batch size is limited to 1–500 events; byte counters and durations are bounded.
- Duplicate event IDs in one batch are rejected.
- Unit tests cover valid events, forbidden fields, fixture enforcement, limits, and duplicate IDs.

This is a data contract only. It does not yet execute tests, stream events, persist reports, authenticate a private lab route, or publish data. Those capabilities must be implemented in later phases and verified independently.

## Execution and publication pipeline

1. A private, server-authorized runner starts a named test against an isolated synthetic fixture.
2. The runner emits structured events matching the schema.
3. A run aggregator binds events to the exact application commit, harness version, runtime, and environment.
4. A validator checks schema, ordering, run identity, size limits, and completeness.
5. A redaction/review step produces a public-safe report; no raw private event stream is exposed.
6. A human explicitly approves publication.
7. The public dashboard reads only approved, versioned report artifacts.

## Safety and access requirements

- No production database, real account, real Gmail connection, production key, or production secret may be used by the lab.
- The private lab must enforce owner authorization server-side on every page and API route, with deployment protection as defense in depth.
- Public endpoints are read-only and serve approved artifacts only.
- No public route may invoke test execution or accept arbitrary test payloads.
- Test runs are bounded by time, concurrency, request size, and fixture scope.
- Findings remain private until safely remediated and reviewed for disclosure.
- Test output and visualizations must show the exact scope and limitations; a PASS is never a general security guarantee.

## Next implementation sequence

1. Build deterministic local runners that emit this event contract from existing unit/integration tests.
2. Add a run manifest and immutable private artifact format tied to commit and harness version.
3. Add schema/order/completeness validation and secret-redaction tests.
4. Add owner-only private orchestration after selecting and verifying a genuinely isolated non-production environment.
5. Connect the public dashboard only to reviewed, approved report artifacts.
6. Drive dashboard motion from actual run events; render idle honestly when no run is active.

No deployment, production configuration change, live database migration, or main-branch modification is authorized by this document.
