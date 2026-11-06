# Authenticator Vault — Schema / API Gap Review

**Status:** Design review only. No runtime implementation or database migration is authorized.
**Branch:** `feature/vault-authentication`

## Review scope

Compared:
- `docs/AUTHENTICATOR_VAULT_API_CONTRACT.md`
- `docs/sql-drafts/202611060004_authenticator_vault.sql`
- `docs/AUTHENTICATOR_ATOMIC_RECOVERY_FINALIZATION_DESIGN.md`
- Current Auth recovery route handlers and `supabase/migrations/202611060003_recovery_claims.sql`.

## 1. Result: implementation blocker

The SQL draft currently creates:
- `vault_key_envelopes` — active password/recovery wrappers and version.
- `vault_auth_factors` — encrypted TOTP and backup-code bundles and version.

It does not store the recovery operation lifecycle described in the API contract. There is no new-operation claim, pending wrapper generation, pending verifier, operation status, idempotency record, or cleanup state. Therefore the API contract cannot safely be implemented against this SQL draft as-is.

## 2. Existing behavior verified

- The app uses Next.js App Router route handlers.
- Authenticated routes use the cookie-backed Supabase server client and `supabase.auth.getUser()`.
- Privileged DB operations use the server-only Supabase admin client.
- Current recovery starts before a Vault session exists: Login ID + current Recovery Code.
- The current server generates the replacement Recovery Code, computes its scrypt verifier, and temporarily stores an encrypted copy so a lost response can be retried.
- The legacy acknowledgement RPC promotes only the Recovery Code hash and salt. It does not promote an Authenticator VDK wrapper.
- The current Authenticator SQL draft is outside `supabase/migrations/` and has not been applied.

## 3. Required additive schema

A separate future table is required, proposed name: `public.vault_authenticator_recovery_operations`.

Minimum fields:
- operation UUID and Vault `user_id`
- status: `claimed`, `code_issued`, `staged`, `finalized`, `abandoned`, or `expired`
- hash/verifier of a high-entropy claim handle (never the raw handle)
- expected active envelope version
- pending password wrapper fields and KDF metadata
- pending recovery wrapper fields and KDF metadata
- server-generated pending Recovery Code hash and salt
- short-lived encrypted copy of the pending Recovery Code for response-loss recovery
- expiry, created/updated timestamps, and finalized timestamp

Required rules:
1. Operation owner must match envelope owner.
2. At most one non-terminal operation per user/envelope generation.
3. State-dependent constraints require all pending fields before finalization.
4. Expiry and encrypted-payload sizes are bounded.
5. RLS enabled; no direct browser table access; server-only access after owner verification.
6. Temporary encrypted Recovery Code copy is cleared at finalize, abandon, or expiry.
7. No plaintext Recovery Code, password, VDK, derived key, TOTP seed, or backup code is stored.

Exact FK and index definitions must be reviewed against the final schema before executable SQL is written.

## 4. API contract corrections required

The current API draft has the browser submit `pendingRecoveryCodeVerifier`. Do not trust a client-provided verifier as authoritative.

Use this sequence instead:

1. **Claim:** pre-session route verifies the current Recovery Code, creates a new operation bound to user + envelope version, and returns a high-entropy claim handle. The current code is transiently received over HTTPS for verification, never logged or stored in plaintext.
2. **Issue code:** server generates the replacement Recovery Code, computes its scrypt verifier itself, and stores a short-lived encrypted copy for safe retry. Return the same pending code for the same operation if the first response is lost; never generate a second code for that operation.
3. **Browser wrapping:** browser derives the recovery wrapping key locally from the returned code and encrypts the VDK. The VDK and derived key never reach the server.
4. **Stage:** browser sends the new encrypted wrappers and new Master Password. The password is transiently received over HTTPS because Supabase Auth must update it server-side; never log it. Do not accept a client-supplied Recovery Code hash/salt.
5. **Finalize:** after signing in with the new password, the authenticated owner submits the operation handle. One Postgres transaction promotes password wrapper, recovery wrapper, and server-generated verifier together, increments envelope version once, marks the operation finalized, and clears pending material.
6. **Retry/abandon:** status lookup and retries are idempotent. Abandon/expiry clears pending material only and never changes the active generation.

The existing legacy acknowledgement RPC must not be used for this flow.

## 5. Cross-system failure handling

Supabase Auth password updates and Postgres transactions cannot be one shared transaction. The implementation must define a recoverable saga for the interval between password update and pending DB stage. Retries must resume the same operation safely; they must not create a second code or leave an ambiguous active generation. Do not describe the whole operation as atomic across Supabase Auth and Postgres. Only the final promotion of the database generation can be atomic.

## 6. Other contract gaps

- SQL has no pending factor-enrollment state. Decide whether unverified factors are stored as pending or only inserted after first TOTP verification.
- Define trusted provenance for `google_subject`; do not treat arbitrary user input as verified identity.
- Define `backupCodes: null` as clear versus omitted as no change.
- Define explicit wrapper-rotation/password-change behavior.
- Server must validate base64url byte lengths, AES-GCM IV/tag sizes, KDF allowlist/version/parameter bounds, body size, and owner scope.
- Version columns alone are insufficient: every update must compare expected version and increment exactly once.

## 7. Approval gates

- [ ] Approve the corrected code-issue/stage/finalize sequence.
- [ ] Approve the operation table and exact RPC contract.
- [ ] Approve the password-update retry/saga behavior.
- [ ] Approve KDF implementation and parameter bounds.
- [ ] Approve factor identity provenance and enrollment state.
- [ ] Keep future SQL under a draft path until separately approved.
- [ ] Test transaction rollback, concurrent claims/finalization, response loss, expiry, and cross-user isolation.

## 8. Explicit non-changes

No existing recovery route/RPC, Gmail behavior, active migration, Supabase database, `main`, or Production was changed by this review.
