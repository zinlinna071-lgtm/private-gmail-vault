# Gmail OAuth Route Test Plan

Status: planning only. No production route or encryption implementation is changed by this document.

## Test harness already available

- Vitest runs in Node and aliases `server-only` to `tests/server-only.ts`.
- Existing tests use `vi.hoisted` mocks and `vi.mock` for Supabase modules.
- Gmail refresh-token encryption already has round-trip, random-IV, tamper, and missing-key tests.
- The Gmail OAuth connect and callback routes currently have no dedicated route tests in the reviewed test set.

## Callback route test matrix

1. No authenticated Vault user: redirects to sign-in-required and clears the OAuth state cookie.
2. Missing state, state mismatch, malformed cookie, or invalid signature: rejects before any Google token exchange.
3. Google authorization denial: returns a safe denial result and does not exchange a code.
4. Missing code or missing OAuth configuration: returns a safe configuration error.
5. Token endpoint failure, malformed JSON, or missing access token: rejects without writing a Gmail connection.
6. Scope verification failure or missing gmail.readonly grant: rejects without persisting tokens.
7. Google profile failure, missing subject/email, or unverified email: rejects without persisting tokens.
8. Existing connection lookup error: does not overwrite stored credentials.
9. New refresh token: encrypts and persists the token with its encryption version.
10. No new refresh token but an existing connection: preserves the previous ciphertext, IV, auth tag, and actual stored encryption version.
11. No new refresh token and no existing token: fails closed.
12. Upsert failure: returns a safe error and never exposes provider tokens.
13. Audit insert failure: explicitly define whether the connection remains successful; test the chosen behavior.
14. All redirects clear the short-lived OAuth state cookie.
15. Assert no response body, redirect URL, or audit metadata contains access tokens, refresh tokens, authorization codes, or client secrets.

## Connect route test matrix

1. Unauthenticated user cannot initiate OAuth.
2. Missing client ID or redirect URI fails safely.
3. Invalid protocol or callback path is rejected.
4. Valid configuration redirects to Google's authorization endpoint.
5. Requested scopes include openid, email, profile, and gmail.readonly.
6. State cookie is HttpOnly, SameSite=Lax, callback-path scoped, and expires after 600 seconds; Secure is enabled in production.
7. State is bound to the authenticated Vault user and cannot be reused across users.

## Token encryption boundary tests

- Reject empty and over-limit plaintext tokens.
- Reject decrypt with a different key.
- Reject invalid IV and authentication-tag lengths.
- Reject malformed ciphertext.
- Preserve existing tamper-detection tests.

## Important implementation issues to keep separate from tests

- Callback currently hardcodes key version 1 when retaining an existing encrypted refresh token; it should preserve the selected row's stored version.
- Token-info currently sends the access token in the query string. Verify Google's supported POST form before changing the request method.
- The decryption helper does not yet use the persisted key version or authenticated additional data (AAD). Design and migration must precede implementation.
- Refresh-token handlers currently mark a connection for reauthorization on every non-2xx token response. Distinguish invalid_grant from transient provider failures before changing status behavior.

## Execution boundary

Run these tests only with mocks and synthetic credentials. Do not use a live Gmail account, real OAuth secrets, or the active Supabase project. Do not change the production implementation, database schema, Main branch, or production deployment as part of this test-only phase.
