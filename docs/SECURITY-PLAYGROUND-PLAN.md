# Security Playground Plan

**Status:** Design approved for implementation planning; no Playground UI or deployment exists yet.
**Default exposure:** Private only.
**Branch:** `feature/vault-authentication`
**Safety rule:** Never use real account passwords, recovery codes, production keys, or a real production vault in Playground tests.

## 1. Decision: private first

The Security Playground is an owner-only test area for exercising the vault's security controls. It must not be publicly accessible while the application is still a prototype and the client-side zero-knowledge migration is incomplete.

A public demo may be considered later, but it must be a separate deployment and separate application environment using synthetic data only. It must have no shared database, auth project, encryption keys, cookies, storage bucket, or secrets with the private vault.

Private does not mean merely hiding a link. Access must be enforced on the server for every Playground page and API route. Use a dedicated allowlist/owner check and deployment-level access protection as defense in depth. Deny by default. Do not rely on client-side route guards alone.

## 2. Goals

- Let the owner manually run safe, repeatable security checks.
- Show what was tested, the expected behavior, the observed result, and evidence.
- Separate verified controls from planned or untested controls.
- Catch regressions before any production release.
- Never expose real secrets in test output, logs, screenshots, or stored reports.

The Playground is a test harness, not a certification, penetration-test substitute, or promise that the system is unbreakable.

## 3. Isolation requirements

1. Use a dedicated non-production environment and synthetic test identities/data.
2. Do not connect it to a real Gmail account or any third-party account containing user data.
3. Do not use production Supabase projects, production database rows, production encryption keys, or production OAuth credentials.
4. Keep test data disposable; provide a reset operation that only affects the isolated test environment.
5. Keep test execution bounded: request size, duration, concurrency, and rate limits.
6. No arbitrary URL fetch, shell execution, user-supplied script execution, or tests against third-party targets.
7. Every active test must target only the Playground's own isolated test services.
8. Redact secrets and key material from all diagnostics. Record identifiers and outcomes, never plaintext credentials or raw keys.

## 4. Test modules

### A. Authentication and session
- Unauthenticated request is denied.
- Expired/revoked session is denied.
- Logout invalidates access as designed.
- Session and Vault-lock states remain separate.
- Owner allowlist is enforced server-side.

### B. Master Password and KDF
- Password is processed locally only; it must never be sent to the application server or Supabase Auth.
- Wrong password cannot unwrap the data key.
- Rate limits and bounded KDF parameters are enforced.
- No credential or derived-key values appear in logs.
- KDF performance and memory tests run only with synthetic inputs on supported real devices.

### C. Encryption and key envelope
- AES-256-GCM round-trip succeeds.
- Modified ciphertext, IV, tag, envelope, or associated context is rejected.
- Wrong vault ID, wrong KEK, or wrong DEK cannot decrypt.
- Nonces are freshly generated.
- Wrapped DEK cannot be used as plaintext without successful local unwrap.
- Mutable buffers are cleared best-effort; document JavaScript/WASM zeroization limitations.

### D. Authorization and data isolation
- User A cannot read, update, or delete User B's records.
- Guessed or modified record IDs do not bypass ownership checks.
- Missing/invalid authentication is denied.
- API responses contain ciphertext envelopes only after the ciphertext-only migration is complete.

### E. API and browser protections
- Same-origin and content-type validation.
- CSRF and IDOR regression checks.
- Oversized, malformed, invalid UTF-8, and unexpected JSON payloads are rejected.
- XSS/CSP checks and sensitive-data exposure review.
- Security headers and cache behavior are verified.

### F. Recovery and migration
- Recovery succeeds only through the explicitly designed recovery flow.
- No silent server-side decryption fallback.
- Legacy records are migrated only through a user-mediated, verified path.
- Lost Master Password and lost passkey scenarios are tested before any old login path is removed.

## 5. Result format

Each check records:
- Stable test ID and module.
- Preconditions and synthetic fixture identifier.
- Expected behavior.
- Actual result.
- Status: `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`.
- Evidence reference with all secret values redacted.
- Date, application commit, browser/runtime, and test-harness version.

Do not produce a single arbitrary “security percentage” or letter grade. Summaries should report pass/fail counts, untested areas, known limitations, and the exact commit tested. A green result means only that the listed checks passed in that environment.

## 6. Delivery phases

### Phase 0 — documentation and test inventory
- Keep this plan and map each test to a control, owner, and evidence source.
- Reuse isolated cryptographic KAT harnesses where appropriate.
- Do not deploy or connect live services.

### Phase 1 — local/CI-only harness
- Implement deterministic unit and integration tests.
- Keep all attack fixtures synthetic and local.
- Run in GitHub Actions on the feature branch.
- Do not expose a public route or create a production deployment.

### Phase 2 — private manual Playground
- Build an owner-only interface in a dedicated non-production environment.
- Require server-enforced owner authorization and deployment access protection.
- Provide safe buttons for bounded tests, synthetic fixtures, reset, and redacted reports.
- Explicitly label tests that cannot be safely run in-browser and link to CI evidence instead.

### Phase 3 — private device testing
- Test supported Android and iOS devices for KDF latency, memory pressure, browser suspension, and unlock/lock behavior.
- Record device/browser versions and repeatable measurements.
- Do not infer mobile performance from hosted desktop browser tests.

### Phase 4 — optional public demonstration (not approved)
- Only if explicitly requested later.
- Separate deployment, auth, database, keys, storage, and cookies from the private vault.
- Synthetic demo records only; no real credentials or real user vaults.
- Disable destructive and high-volume attack controls.
- Clearly label it as a demonstration, not an audit or certification.

## 7. Current verified evidence and limitations

- The isolated Argon2id Node.js harness passed the exact RFC 9106 §5.3 known-answer vector and four input-mutation checks in GitHub Actions run [42272387331](https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42272387331).
- The isolated Chromium browser harness passed the same vector and four mutation checks in run [42281120467](https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42281120467).
- The expanded Chromium, Firefox, and WebKit run completed successfully in GitHub Actions run [42281411743](https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42281411743).
- The regular CI run for the current multi-browser revision completed successfully in run [42281418698](https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42281418698).

These are compatibility/KAT results for an isolated candidate library, not a complete vault security assessment. Real Android/iOS performance, memory pressure, production KDF selection, the client-side unlock flow, ciphertext-only API migration, recovery design, and independent cryptographic review remain outstanding.

## 8. Release gates

The Playground must not be presented as a measure of production security until:
- Client-side encryption and local unlock are implemented end-to-end.
- The server accepts and returns ciphertext only.
- Per-user authorization and isolation tests pass.
- Recovery and legacy migration are designed and tested.
- Real supported-device testing is complete.
- The private environment is independently verified to be isolated from production.
- A security review has examined the implementation and test coverage.

Until then, the app remains a development prototype. Do not store real high-value credentials in it.
