# Authenticator Vault Atomic Recovery Finalization Design

**Status:** Proposed contract for review. Not executable SQL or implementation authorization.
**Branch:** `feature/vault-authentication`
**Compatibility rule:** Existing `vault_profiles` recovery RPCs remain unchanged until a separate approval.

## 1. Problem to solve

The current `acknowledge_vault_recovery_code(p_user_id)` function promotes only the pending Recovery Code hash and salt into `vault_profiles`. It does not update an Authenticator Vault recovery-wrapped VDK or password wrapper.

Using that function to finish Authenticator Vault recovery could create a split generation: the server accepts a new Recovery Code while the stored VDK remains wrapped by the old code, or vice versa. The authenticator recovery flow must therefore use its own transaction boundary.

## 2. Required generation model

Treat the active credential set as one generation:

- active Recovery Code verifier (hash + salt, server-side)
- active recovery-wrapped VDK (ciphertext + IV + tag + KDF name/version/salt/parameters)
- active password-wrapped VDK (ciphertext + IV + tag + KDF name/version/salt/parameters)
- monotonically increasing envelope version

All three credential materials must be promoted together. A pending generation is never used to unlock data before finalization.

## 3. Proposed pending data

The envelope storage design needs a pending transition record, either as nullable pending columns on `vault_key_envelopes` plus a server-only verifier field in a separate table, or as a dedicated server-only transition table.

Minimum pending fields:

- `operation_id` UUID, unique and unguessable
- `transition_type` (recovery or recovery-code rotation)
- `claim_token_hash` (store a verifier/hash rather than a raw claim token where feasible)
- `expected_active_version` bigint
- pending password wrapper fields (ciphertext, IV, tag, KDF metadata) when recovery resets the password
- pending recovery wrapper fields (ciphertext, IV, tag, KDF metadata)
- pending Recovery Code verifier hash and salt (server-side only)
- `expires_at`, `created_at`
- transition status constrained to a small state set

Do not store plaintext Recovery Code, VDK, derived key, TOTP seed, or backup code in any pending row. The pending Recovery Code itself is only shown to the user once in the browser; the server receives its verifier and encrypted VDK wrapper.

## 4. Proposed API / transaction contract

These are conceptual operations, not existing endpoints:

### A. claim_recovery

Input: authenticated Vault identity, submitted Recovery Code, client-generated operation ID.

Server:
1. Apply rate limits.
2. Verify the submitted code against the active verifier without exposing account/code validity details.
3. Atomically claim only if there is no unexpired claim.
4. Bind the claim to the authenticated Vault user, operation ID, and current envelope version.
5. Return a short-lived opaque claim handle.

The server must never receive the plaintext VDK or derived wrapping key.

### B. stage_recovery

Input: claim handle, operation ID, expected version, new password wrapper, new recovery wrapper, new Recovery Code verifier, expiry.

Server:
1. Authenticate session and validate claim ownership/lease.
2. Validate encoding lengths, KDF allowlists, parameter bounds, IV/tag format, and expiry.
3. Insert/update the pending generation only if expected active version still matches.
4. Keep every active field unchanged.
5. Return staged status without returning secret material.

### C. finalize_recovery

Input: authenticated Vault identity, claim handle, operation ID, expected active version, explicit acknowledgement token.

In one database transaction:
1. Lock the envelope and pending transition rows.
2. Verify owner, claim, operation ID, pending state, expiry, and expected version.
3. Verify all required pending fields are present and internally consistent.
4. Promote pending password wrapper, recovery wrapper, and Recovery Code verifier together.
5. Increment active envelope version exactly once.
6. Mark operation finalized and clear pending ciphertext/verifier/claim material.
7. Commit.

If any check fails, rollback all changes. There must be no code path that promotes the Recovery Code verifier independently of its matching recovery wrapper.

### D. abandon_or_expire_recovery

Input: authenticated user or scheduled cleanup.

- User may abandon their own pending operation.
- Cleanup may remove only expired pending transition data.
- Neither path may alter active wrappers or active Recovery Code verifier.
- Cleanup must be idempotent.

## 5. Idempotency and failure semantics

- Repeating stage with the same operation ID and identical payload metadata returns the existing staged result; conflicting payload under the same ID is rejected.
- Repeating finalize after a successful commit returns the recorded finalized outcome without incrementing version again.
- Repeating finalize with a different operation ID, stale version, expired claim, or mismatched claim fails closed.
- A network timeout after commit is resolved by querying operation status; never blindly stage a second recovery.
- If the browser closes before acknowledgement, pending data expires and the old active generation remains valid.
- Concurrent claims: exactly one active claim per user/envelope generation.
- Concurrent envelope updates: compare-and-swap on expected version; only one succeeds.

## 6. Database constraints and access

- Unique operation ID per user.
- At most one active pending transition per envelope.
- Pending transition user ID must match envelope user ID.
- Pending transition type/status constrained by CHECK constraints.
- Expiry must be in the future when staged and bounded by server policy.
- No browser role has direct table access; authenticated server routes use service role only after validating the Vault session and owner scope.
- RPCs must have fixed `search_path`, revoke PUBLIC/anon/authenticated execute, and grant execute only to service_role.
- Any SECURITY DEFINER function must validate all arguments and avoid dynamic SQL.
- Use row locks and compare-and-swap conditions; do not rely on application-level read-then-write alone.

## 7. Required tests before implementation

1. Successful recovery promotes password wrapper, recovery wrapper, and verifier in one transaction.
2. Force failure after each individual promotion statement; all changes rollback.
3. Wrong claim, wrong operation ID, wrong user, stale version, and expired lease cannot finalize.
4. Pending fields missing or malformed cannot finalize.
5. Two concurrent finalize calls produce one version increment and one finalized operation.
6. A timeout after commit followed by retry returns finalized status without a second rotation.
7. Expiry cleanup removes pending fields only and preserves active generation byte-for-byte.
8. Abandoning a pending operation preserves active generation.
9. Existing legacy Recovery Code rotation continues to work unchanged while this feature is not enabled.
10. No response, audit event, or server log contains plaintext Recovery Code, VDK, TOTP seed, backup codes, or derived keys.
11. Cross-user operation IDs and claim handles cannot read or mutate another user's pending state.
12. Existing Gmail connections and message APIs are unaffected by authenticator recovery transitions.

## 8. Migration and rollout gates

- [ ] Approve the KDF and browser cryptography implementation separately.
- [ ] Approve pending transition schema and server-only Recovery Code verifier storage.
- [ ] Approve exact RPC signatures and state transitions.
- [ ] Add version columns and compare-and-swap updates to the schema draft.
- [ ] Test transaction behavior against a disposable Supabase/Postgres database.
- [ ] Add integration tests and failure-injection tests.
- [ ] Review security and compatibility with existing recovery flows.
- [ ] Only after explicit user approval, move reviewed SQL into a migration and apply it to a non-production environment.
- [ ] Production migration, merge, and deployment require separate explicit approval.

## 9. Explicit non-goals

This design does not bypass Google Prompt, Google's account recovery, or Google's sign-in checks. It does not retrieve Google backup codes through Gmail API. It does not authorize any live database or production change.
