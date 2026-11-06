# Gmail OAuth Callback Review Findings

Date: 2026-11-06
Branch: `feature/vault-authentication`

## Review scope

Reviewed:
- `app/api/gmail/callback/route.ts`
- `tests/gmail-callback-route.test.ts`
- `tests/gmail-callback-success.test.ts`

This was a static code review plus mocked CI coverage. No live Gmail account, Google OAuth credential, or production database was used.

## Confirmed findings

### GCB-01 — Existing refresh-token key version is not preserved

**Severity: High before introducing key rotation; currently conditional on use of a non-v1 key.**

When Google omits a new `refresh_token`, the callback reuses the previously stored ciphertext, IV, and authentication tag. However, the lookup selects only those three fields and the reuse branch hardcodes `keyVersion: 1`.

Consequences:
- If the existing token was encrypted under a later key version, the upsert overwrites its recorded version with `1`.
- A future decrypt path may select the wrong key and make the saved Gmail connection unusable.
- The current encryption helper emits version 1, so this is a forward-compatibility defect unless another version is already present in the database.

**Recommended remediation:** select the stored `encryption_key_version`, validate it as a supported positive integer, and preserve it unchanged when reusing the existing encrypted token. Add a regression test that seeds a non-v1 stored version and verifies the upsert preserves it. Do not silently coerce an unknown or missing version to 1.

### GCB-02 — Access token is placed in the tokeninfo URL query string

**Severity: Medium.**

The callback calls Google tokeninfo with `?access_token=...`. Query strings can be captured by URL-level logs, tracing, proxies, or diagnostics more readily than request bodies.

**Recommended remediation:** use Google's supported POST form for tokeninfo verification, placing the access token in an `application/x-www-form-urlencoded` request body, with `cache: "no-store"`. Confirm the exact current Google endpoint contract before implementation and test that the token is absent from the URL.

### GCB-03 — Audit-event insert failure is ignored

**Severity: Medium; depends on whether the audit trail is required for successful connection completion.**

The callback awaits the `vault_audit_events` insert but does not inspect its returned `error`. A connection can therefore be reported as successful even if the audit event was not persisted.

**Recommended remediation:** decide explicitly whether audit persistence is mandatory or best-effort. If mandatory, handle the insert error and define a safe reconciliation/rollback strategy; do not assume a database transaction spans the connection upsert and audit insert. If best-effort, retain the current behavior but add structured server-side observability and a test documenting that policy.

## Existing test coverage after this review

The mocked success-flow test now exercises:
- authorization-code POST exchange;
- Gmail read-only scope verification;
- verified Google profile handling;
- refresh-token encryption invocation;
- connection lookup and upsert path;
- successful redirect.

The callback negative-path suite covers unauthenticated access, invalid state, state bound to another Vault user, Google authorization denial, and missing callback code.

## Next safe implementation sequence

1. Add a regression test for GCB-01 using a stored encryption key version other than 1.
2. Review the failure and confirm the expected schema/type contract for `encryption_key_version`.
3. Obtain approval before changing production callback behavior.
4. Separately verify Google's current tokeninfo POST contract, then add a test and implement GCB-02.
5. Agree whether audit persistence is mandatory before changing GCB-03.

No production code was changed by this review. No deployment or merge was performed.
