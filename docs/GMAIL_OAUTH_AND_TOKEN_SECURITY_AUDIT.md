# Gmail OAuth and Token Security Audit

Date: 2026-11-06
Branch: `feature/vault-authentication`
Scope: Read-only review of Gmail OAuth connect/callback, message list/detail handlers, refresh-token encryption, related tests, and initial database schema.

## Safety boundary

This is a source-code audit, not a live OAuth or Gmail penetration test. No Google account, OAuth credential, Supabase project, database, or production deployment was accessed or changed. Findings describe code paths and design risks, not confirmed exploitation.

## Positive controls observed

- Gmail connection initiation requires an authenticated Vault session.
- OAuth state uses a 32-byte random nonce, is stored in an HttpOnly cookie, and is HMAC-bound to the Vault user ID.
- The callback checks the returned state against the cookie and validates the HMAC with a timing-safe comparison.
- OAuth callback verifies that Google granted the Gmail read-only scope instead of assuming requested scopes were granted.
- Google profile email must be marked verified, and the stable Google subject is used to identify the connected account.
- Refresh tokens are encrypted server-side using AES-256-GCM before database storage.
- Gmail list and message-detail queries scope the privileged connection lookup by the authenticated Vault user's ID and active connection status.
- Gmail message responses use private no-store cache headers. Gmail API failures are generally mapped to stable error identifiers rather than raw provider response bodies.
- The initial schema enables RLS and revokes direct table privileges from anon/authenticated roles; server-side routes use the service role.

## Findings and recommendations

### 1. Refresh-token encryption has no authenticated context (AAD)

`lib/gmail/token-encryption.ts` uses AES-256-GCM but does not set additional authenticated data. The ciphertext is therefore not cryptographically bound to the Vault user, connection ID, Google subject, purpose, or envelope version.

Recommendation: introduce a versioned encryption envelope and AAD containing at minimum the user ID, connection ID or stable account identity, purpose (Google refresh token), and schema version. Bind the values at encryption and decryption, and reject mismatches. Plan this as a versioned migration with a tested re-encryption path; do not silently change the existing format.

### 2. Encryption key version is persisted but not used during decryption

The helper returns `keyVersion: 1`, while `decryptRefreshToken` accepts only ciphertext, IV, and tag and always uses the single current `VAULT_ENCRYPTION_KEY`. The Gmail callback's existing-connection lookup does not select `encryption_key_version`; when it reuses an old ciphertext because Google did not issue a new refresh token, it writes `keyVersion: 1` again.

This is internally consistent only while there is exactly one encryption key and one format. It does not implement key rotation despite the database column.

Recommendation: select and preserve the existing key version when retaining ciphertext; implement an explicit version-to-key resolver and reject unknown versions. Add migration tests for old/new key versions before rotating any live data.

### 3. Google token introspection sends the access token in a URL query parameter

The callback calls the tokeninfo endpoint using `?access_token=...`. Query parameters can be captured in URL-level infrastructure logs or diagnostics. Although the request is HTTPS and no-store, avoiding the token in the URL is preferable.

Recommendation: use Google's supported POST form for token introspection, with the access token in the request body, and ensure request bodies are not logged. Verify the currently supported Google endpoint contract before implementation.

### 4. OAuth state cookie is signed but not a server-side one-time transaction

The nonce is protected by a signed HttpOnly cookie and a ten-minute max age. It is not recorded as a server-side one-time transaction, so the application relies on Google authorization-code single-use behavior and cookie deletion after callback. The current callback deletes the cookie on its redirect paths, which is useful, but there is no durable replay ledger or explicit consumed-state record.

Recommendation: consider a short-lived, single-use OAuth transaction record keyed by a hash of the nonce, bound to the Vault user, with expiry and atomic consumption. Keep state validation before processing provider error/code values. This is defense-in-depth; do not add a database round trip without assessing reliability and cleanup.

### 5. OAuth state signing and refresh-token encryption share one key

Both OAuth state HMAC and refresh-token AES-GCM use `VAULT_ENCRYPTION_KEY`. This couples OAuth login initiation to the token-encryption key and makes independent key rotation or incident response harder.

Recommendation: derive purpose-separated keys using a documented KDF or configure distinct server-only keys for OAuth state signing and token encryption. Add explicit key IDs/versions and a staged rotation plan. Never expose either key to the browser.

### 6. Token refresh failure is treated as reauthorization-required for every non-2xx response

The list and detail handlers set `connection_status = reauthorization_required` whenever Google's token endpoint responds non-OK. A transient 5xx, rate limit, or network-related provider failure may not mean the refresh token was revoked.

Recommendation: classify provider errors. Mark reauthorization required only for definitive invalid/revoked grant conditions; treat transient 429/5xx outcomes as retryable without changing the connection's durable status. Preserve generic client responses and avoid storing raw provider bodies.

### 7. Gmail API handlers have no dedicated route tests

The current test inventory includes `tests/gmail-token-encryption.test.ts`, but no tests for OAuth connect/callback, message list, or message detail routes.

Recommended tests include:
- unauthenticated connect/callback/list/detail requests;
- missing/mismatched/expired/replayed OAuth state and cross-user state binding;
- provider denial, malformed token response, missing/insufficient scopes, unverified profile;
- Google omitting a new refresh token while an existing encrypted token is retained, including preservation of its key version;
- tampered ciphertext, wrong AAD, unknown key version, and key rotation;
- cross-user accountId and message ID access attempts;
- refresh endpoint 400 invalid_grant versus 429/5xx transient failures;
- no-store headers and ensuring access/refresh tokens never appear in responses or logs;
- oversized or malformed message payloads and attachment metadata.

### 8. Message body is returned as text, but parsing limits and content handling need tests

The detail handler converts HTML to text and caps the returned body at 100,000 characters. It does not return raw HTML, which reduces active-content risk. However, MIME nesting depth, total payload size, malformed base64, header length, and HTML entity handling need explicit limits and regression tests. Email content is untrusted user-controlled data and must remain text-rendered in the UI.

## Remediation order

1. Add Gmail route tests and test current behavior without changing production code.
2. Design versioned token encryption with AAD and key-version resolution.
3. Move tokeninfo access token out of the URL after confirming Google's supported request format.
4. Classify refresh-token provider errors so transient failures do not disable valid connections.
5. Decide whether server-side one-time OAuth transaction storage is warranted.
6. Implement each change behind a reviewed migration/compatibility plan; test in a disposable Supabase and Google OAuth test project before any live-account migration.

## Current conclusion

The code already has meaningful controls: user-bound OAuth state, verified scope checks, server-side AES-GCM refresh-token encryption, authenticated-user scoping, and private no-store message responses. The main gaps are the missing AAD/key-rotation implementation, access token in the tokeninfo URL, overly broad reauthorization handling for provider failures, and absent Gmail route tests. No live data or production behavior was changed.
