# Gmail OAuth Callback Review Findings

Date: 2026-11-06
Branch: `feature/vault-authentication`

## Review scope

Reviewed:
- `app/api/gmail/callback/route.ts`
- `tests/gmail-callback-route.test.ts`
- `tests/gmail-callback-success.test.ts`
- Versioned refresh-token encryption and its CI coverage.

Static review and mocked CI only. No live Gmail account, Google OAuth credential, or production database was used.

## Findings and remediation status

### GCB-01 — Existing refresh-token key and format versions are preserved

<badge>Resolved in branch</badge>

The callback now selects `encryption_key_version` and `encryption_format_version`, validates the stored versions, and preserves both alongside the existing ciphertext, IV, and authentication tag when Google omits a replacement refresh token.

Regression coverage seeds key version 7 / format version 2 and asserts that both are retained. The Gmail list and message-detail routes now select and pass the stored versions to the decrypt helper with Vault user ID and verified Google subject context.

This is branch-level code and mocked test evidence only. Migration 004 remains unapplied; existing database compatibility must be confirmed before deployment.

### GCB-02 — Access token is placed in the tokeninfo URL query string

**Status: Open — Medium**

The callback calls Google tokeninfo with `?access_token=...`. Query strings can be captured by URL-level logs, tracing, proxies, or diagnostics more readily than request bodies.

**Recommended remediation:** verify Google's currently supported tokeninfo request contract, then use a supported POST form with the access token in an `application/x-www-form-urlencoded` body if supported. Add a test asserting the token is absent from the URL. Do not change the endpoint method based on assumption alone.

### GCB-03 — Audit-event insert failure is ignored

**Status: Open — Medium; policy-dependent**

The callback awaits the `vault_audit_events` insert but does not inspect its returned `error`. A connection can therefore be reported as successful even if the audit event was not persisted.

**Recommended remediation:** decide whether audit persistence is mandatory or best-effort. If mandatory, define a safe reconciliation strategy because the connection upsert and audit insert are not one transaction. If best-effort, add safe operational observability and a test documenting that policy. Never log credentials or tokens.

## Existing test evidence

The mocked success-flow tests cover:
- authorization-code POST exchange;
- Gmail read-only scope verification;
- verified Google profile handling;
- refresh-token encryption invocation with Vault-user / Google-subject context;
- connection lookup and upsert;
- preservation of existing ciphertext and both version fields when no new refresh token is returned.

Latest CI for commit `d48040dd1772185f16df74b87d55e69c564e8921` completed successfully for both push and pull-request events. No live Google or database integration was exercised.

## Remaining safe sequence

1. Verify the current Google tokeninfo contract before considering GCB-02.
2. Decide and document the audit persistence policy before changing GCB-03.
3. Keep migration 004 unapplied until its rollout and existing-row compatibility checks are explicitly approved.

No production deployment, merge, live Gmail operation, or database migration was performed.
