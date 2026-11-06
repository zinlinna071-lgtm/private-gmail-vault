# Authenticator Recovery Operations — RPC Contract

**Status:** Review proposal only. No route implementation or database execution is authorized.
**Branch:** feature/vault-authentication

## 1. Scope and compatibility

This document defines the proposed server-only database operations needed by the recovery API. It is additive and separate from the existing legacy recovery claim/finish/acknowledge RPCs. Do not repurpose legacy pending columns or call the legacy acknowledgement RPC for Authenticator Vault recovery.

The operation table is proposed as `public.vault_authenticator_recovery_operations`, linked to the matching `vault_key_envelopes.user_id`. It stores the pending transition, not an active generation.

## 2. Operation record

Required fields:

- `operation_id` UUID primary key; `user_id` FK to the Authenticator envelope owner.
- `status`: `claimed`, `code_issued`, `wrappers_staged`, `staged`, `finalized`, `abandoned`, `expired`.
- `claim_handle_hash`: verifier of a high-entropy random handle; never the raw handle.
- `expected_envelope_version`, `expires_at`, created/updated/finalized timestamps.
- Pending server-generated Recovery Code verifier hash + salt.
- Temporary encrypted copy of the same new Recovery Code, with IV/tag and a short expiry, solely to recover a lost issue-code response.
- Pending password and recovery VDK wrappers, including ciphertext, IV, tag, KDF name/version/salt/parameters.
- `auth_password_update_state`: `not_started`, `in_progress`, `updated`, `failed`.
- `wrappers_payload_fingerprint` for same-payload retry detection.

No plaintext Recovery Code, Master Password, VDK, wrapping key, TOTP seed, or backup code is stored.

## 3. Required database invariants

1. One non-terminal operation per Vault user/envelope generation, enforced by a partial unique index.
2. The operation owner must match the envelope owner.
3. Every claim and stage operation checks the expected active envelope version.
4. Pending Recovery Code verifier is server-generated. The database RPC never accepts a client-supplied verifier as authoritative.
5. The temporary encrypted code copy is bounded by the operation expiry and is cleared on finalization, abandonment, or expiry.
6. Pending wrappers never become active before finalization.
7. Finalization promotes password wrapper, recovery wrapper, and Recovery Code verifier in one Postgres transaction and increments envelope version exactly once.
8. Finalized retries are idempotent for the authenticated owner and operation ID; they never increment the version again.
9. Abandonment and expiry clear pending material only; active envelope and profile verifier remain unchanged.
10. Browser roles have no direct table access. RPC execution is service-role only after the route authenticates and scopes the owner.

## 4. Proposed RPC surface

### 4.1 Claim

`claim_vault_authenticator_recovery(user_id, operation_id, claim_handle_verifier, expected_envelope_version, lease_seconds) -> status`

- The browser creates a random operation UUID and 256-bit claim secret before the request; both remain in volatile memory for the active attempt.
- Called only after the route verifies the submitted current Recovery Code. A browser-supplied user ID is never authorization.
- The database binds operation UUID, owner, expected envelope version, and claim-secret verifier in one transaction.
- Retrying the same operation UUID, claim-secret verifier, owner, and expected version returns the existing status. Reuse with different values fails closed.
- A different operation UUID cannot create a second non-terminal operation for the same user/envelope generation.
- Never store the raw claim secret. Verifier construction and constant-time comparison policy require separate security review.
- If volatile claim material is lost before any Auth password update was attempted, the claim may be abandoned or expire. After an Auth update may have started, reconcile through a successful new-password session for the same user; ordinary lease expiry must not delete it.

### 4.2 Store issued Recovery Code

`store_vault_authenticator_recovery_code(user_id, operation_id, claim_handle_hash, code_hash, code_salt, encrypted_code, iv, auth_tag, copy_ttl_seconds) -> boolean`

- The server generates the replacement code and computes its verifier.
- The server encrypts a short-lived retry copy using a server-only key.
- This operation transitions `claimed` to `code_issued`.
- If a retry finds the operation already `code_issued`, the route returns the same stored code after decrypting the temporary copy; it must not generate a second code.

### 4.3 Stage wrappers

`stage_vault_authenticator_recovery_wrappers(user_id, operation_id, claim_handle_hash, expected_version, payload_fingerprint, pending_password_wrapper, pending_recovery_wrapper) -> boolean`

- Stores the browser-created encrypted wrappers only.
- Does not accept a Recovery Code verifier from the client.
- Transitions `code_issued` to `wrappers_staged`.
- Repeating the same operation with the same fingerprint is idempotent.
- A different fingerprint for the same operation is rejected.
- Active envelope/profile data remains unchanged.

### 4.4 Track Supabase Auth password update

`mark_vault_authenticator_password_update(user_id, operation_id, claim_handle_hash, state) -> boolean`

- Allowed transitions: `not_started -> in_progress -> updated`, with `failed` as a recoverable error state and retry to `in_progress`.
- Once Supabase Auth confirms the new password, mark the operation `staged`.
- Never store the password in the operation row.
- Because Supabase Auth and Postgres do not share a transaction, the route must implement a recoverable saga. If the Auth response is ambiguous, preserve the operation as in-progress and retain pending wrappers; do not infer failure from a missing response. A successful sign-in with the new password, verified server-side for the same user, permits reconciliation even if the original claim secret was lost. Do not automatically retry an ambiguous Auth update until same-password retry semantics are experimentally verified against the exact Supabase Auth version.

### 4.5 Finalize

`finalize_vault_authenticator_recovery(user_id, operation_id, claim_handle_hash, expected_version) -> new_version`

One Postgres transaction:

1. Lock operation and envelope.
2. Verify owner, staged state, claim, expiry, expected version, and successful Auth password update marker.
3. Promote pending password wrapper and recovery wrapper to `vault_key_envelopes`.
4. Promote pending Recovery Code verifier to the user's existing active Recovery Code hash/salt fields.
5. Increment envelope version exactly once.
6. Mark operation finalized and clear pending wrappers, pending verifier, temporary encrypted code copy, and claim verifier.
7. Commit.

The Authenticated route must ensure the user has signed in with the new password before calling this RPC. The RPC does not make Supabase Auth part of the Postgres transaction.

If the operation is already finalized, return the current envelope version without another promotion. This retry path is owner-authenticated and keyed by operation ID.

### 4.6 Abandon and expiry

- `abandon_vault_authenticator_recovery(user_id, operation_id, claim_handle_hash) -> boolean`
- `expire_vault_authenticator_recovery_operations() -> count`

Abandon/expiry may clear pending material only while Auth update state is definitely not_started (or a separately verified failure proves the provider did not change the password). An in-progress or updated operation is not eligible for ordinary lease cleanup; it must enter authenticated reconciliation under a separately approved grace/repair policy. Both operations are idempotent and must never change active wrappers or the active Recovery Code verifier.

## 5. Password update saga — required sequence

The stage endpoint must not update Supabase Auth first and only then attempt to save wrappers. The safer sequence is:

1. Validate the claim and replacement code operation.
2. Persist pending wrappers and a request fingerprint; state becomes `wrappers_staged`.
3. Mark Auth password update `in_progress`.
4. Update Supabase Auth password using the new password transiently over HTTPS.
5. On confirmed success, mark `updated` and transition to `staged`.
6. If Auth update fails, mark `failed`; pending wrappers remain inactive and the same operation can be retried.
7. If the Auth response is ambiguous, preserve in-progress state and pending wrappers. Do not infer failure from a missing response. A successful new-password session for the same user permits authenticated reconciliation. Same-password retry semantics must be tested against the exact Supabase Auth version before implementation.
8. Only after the user signs in with the new password may the route call finalization.

The new password is never stored in this table, logs, analytics, or operation metadata.

## 6. Review blockers before executable SQL

- Verify the exact `vault_profiles` owner key and active Recovery Code hash/salt column names.
- Verify the existing server-side Recovery Code verifier format and generator.
- Decide how a lost claim response is recovered without creating a second claim.
- Verify that Supabase Auth permits safe same-password retry after an ambiguous response.
- Define canonical payload fingerprint construction; do not include plaintext password.
- Define claim handle hashing and constant-time comparison policy.
- Bind encrypted retry-copy AAD to Vault user ID, operation ID, purpose, and schema version.
- Review row locks, partial unique index behavior, RLS, SECURITY DEFINER ownership, fixed search_path, and function grants in a disposable Postgres database.
- Add failure-injection tests for every state transition, concurrent claims/finalization, expiry, and cross-user isolation.
- Confirm terminal-operation retention and cleanup schedule.

## 7. Explicit non-changes

No active migration, Supabase database, legacy recovery RPC, runtime route, Gmail behavior, main branch, or Production deployment is changed by this proposal.


## 8. Critical crash-recovery clarification

Supabase Auth and Postgres cannot commit together. The operation must not be expired or deleted blindly once an Auth password update may have succeeded.

If the provider update succeeds but the server loses the response, the operation may still say `in_progress`. A successful new Vault session for the same owner, established by signing in with the new password, is server-verifiable evidence that the Auth password changed. The authenticated finalize route may record that attestation and continue finalization only after rechecking owner, operation, expected envelope version, expiry/grace policy, and pending payload completeness.

The exact post-Auth-update expiry policy is a blocker before executable SQL:

- A cleanup job must not expire an operation in an unresolved `in_progress` state solely because its ordinary claim lease elapsed.
- Define a bounded reconciliation/finalization grace period or a dedicated recoverable state.
- If Auth password may have changed, preserve enough non-secret operation metadata and pending wrappers for the owner to reconcile safely.
- Never silently delete the pending generation and leave the user with a new Auth password but only an old Recovery Code/VDK wrapper pairing.
- A finalized retry returns the existing finalized result and must not increment the envelope version again.

## 9. Remaining SQL review blockers

- Verify exact `vault_profiles` key/foreign-key and Recovery Code verifier format from the complete migration history.
- Verify every Vault account that can start Authenticator recovery has both an envelope and profile row.
- Define claim response-loss idempotency and behavior after the encrypted issue-code retry copy expires.
- Define claim-handle verifier, payload fingerprint canonicalization, and server-encrypted retry-copy AAD.
- Review operation expiry and cleanup against the post-Auth-update crash window.
- Test the complete RPC contract in a disposable Postgres database before implementation.


## 10. Linked claim idempotency and reconciliation decision

The detailed browser-generated claim-secret, lost-response, reload, encrypted issue-code retry, and post-Auth-update reconciliation policy is specified in `docs/AUTHENTICATOR_RECOVERY_CLAIM_IDEMPOTENCY_AND_RECONCILIATION.md`. This linked document is part of the review proposal. Do not implement the RPC contract until the exact Supabase Auth version's ambiguous-update behavior, payload fingerprint canonicalization, claim verifier construction, and reconciliation retention policy are reviewed and tested.
