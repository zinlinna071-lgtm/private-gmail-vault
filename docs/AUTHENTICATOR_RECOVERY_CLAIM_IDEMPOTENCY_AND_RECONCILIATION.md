# Authenticator Recovery Claim Idempotency and Auth Reconciliation

**Status:** Design proposal only. No SQL execution, runtime implementation, merge, or deployment is authorized.
**Branch:** feature/vault-authentication

## 1. Purpose

This document resolves two gaps in the recovery RPC proposal: a lost claim response and the cross-system crash window between Supabase Auth password updates and Postgres finalization.

## 2. Claim request idempotency

The browser creates a random operation UUID and a 256-bit claim secret before sending the claim request. Both remain in volatile memory for the active attempt. The browser sends the operation UUID and claim secret over HTTPS; it never sends a plaintext Recovery Code verifier as an authoritative database value.

The server verifies the user's existing Recovery Code using the current server-side verifier, validates the operation UUID and claim-secret encoding/length, and stores only a cryptographic verifier of the claim secret. The database binds the operation UUID, user ID, expected envelope version, and claim verifier in one transaction.

A retry using the same user, operation UUID, claim secret, and expected version returns the same operation status. Reuse of the operation UUID with a different claim secret, user, or expected version fails closed. A different operation UUID cannot create a second non-terminal claim for the same user/envelope generation.

The claim secret is never stored in plaintext, localStorage, sessionStorage, logs, analytics, or error reports. The server must use a reviewed keyed verifier or a suitable high-entropy-token hash, with constant-time verification where comparison occurs outside a database equality check.

## 3. Reload and lost volatile state

Before any Auth password update has been attempted, a reload that loses the claim secret may safely abandon the claim or allow its short lease to expire. This must clear pending claim metadata only; active wrappers and the active Recovery Code verifier remain unchanged.

Once the Auth password update may have been attempted, ordinary lease expiry must not delete the operation or its pending wrappers. The user must be able to sign in using the new password and establish a server-verified session for the same Vault user. That authenticated session can reconcile the operation by user ID and operation UUID without requiring the lost in-memory claim secret.

## 4. Issue-code response loss

The replacement Recovery Code is generated once per operation. The server stores its verifier and a short-lived AES-256-GCM encrypted retry copy, bound by AAD to user ID, operation UUID, purpose, and schema version. A retry for the same operation returns the same code only while the encrypted copy is valid. It must never generate a second code for the same operation.

If the encrypted retry copy expires before the code is acknowledged and the Auth password update has not begun, the operation can be abandoned and restarted using the still-active Recovery Code and active VDK recovery wrapper.

If the Auth password update may have begun, the operation cannot be blindly abandoned or expired. It enters reconciliation; no new recovery generation may be started until the user has authenticated with the new password or a separately reviewed safe recovery procedure proves the Auth update did not occur.

## 5. Supabase Auth password update saga

Required order:

1. Verify active Recovery Code and claim.
2. Generate and persist the one replacement Recovery Code for the operation.
3. Browser unlocks the VDK and submits both pending wrappers plus a canonical payload fingerprint.
4. Persist the pending wrapper set; active wrappers remain unchanged.
5. Mark Auth update state as in-progress.
6. Call Supabase Auth password update.
7. On explicit provider success, record updated; do not yet promote active wrappers.
8. Require a successful sign-in with the new password for the same user. The server validates the session with auth.getUser().
9. Reconciliation/finalization atomically promotes the password wrapper, recovery wrapper, and matching Recovery Code verifier, increments envelope version once, marks the operation finalized, and clears pending secret material.

If the Auth update request times out or the server crashes, preserve in-progress and pending data. Do not infer failure from a missing response. A successful new-password session is authoritative evidence that the Auth password changed. If the old password still works, the operation may be retried only under the same operation and after verifying provider semantics; this behavior must be tested against the exact Supabase Auth version before implementation.

## 6. Expiry and cleanup

Use separate timestamps/policies for the ordinary claim lease, issue-code retry-copy expiry, and post-Auth-update reconciliation deadline.

- claimed or code-issued with Auth state not-started may be abandoned/expired after the ordinary lease.
- wrappers-staged with Auth state not-started may be abandoned/expired after the ordinary lease.
- in-progress must never be removed solely because the ordinary lease elapsed.
- updated or authenticated-new-password-attested operations remain recoverable through a bounded reconciliation grace period.
- If the grace period elapses, mark the operation reconciliation-required and retain the minimum pending metadata/wrappers needed for an authenticated repair path. Do not clear the only recovery wrapper or pending Recovery Code generation automatically.
- Finalized retries return the recorded result and never increment the envelope version twice.

The exact retention duration and support/repair policy remain product/security decisions and must be approved before SQL is written.

## 7. Required database invariants

- At most one non-terminal recovery operation per user/envelope generation.
- Operation user ID must match both vault_profiles.user_id and vault_key_envelopes.user_id.
- Claim retries are idempotent only for the same operation UUID and same claim secret.
- Client-supplied user ID is never authorization; every route derives owner identity from a verified session or the pre-auth Recovery Code verification result.
- Pending Recovery Code verifier is generated by the server and is never accepted from the browser as authoritative.
- Active password wrapper, active recovery wrapper, and active Recovery Code verifier are promoted in one Postgres transaction.
- Cleanup never changes the active generation.
- No plaintext password, Recovery Code, claim secret, VDK, TOTP seed, or Google backup code is stored or logged.

## 8. Open blockers before executable SQL

1. Verify exact Supabase Auth version and experimentally test same-password retry after ambiguous update response in a disposable project.
2. Define and review canonical wrapper-payload fingerprint serialization.
3. Select claim-secret verifier construction and constant-time comparison policy.
4. Define reconciliation grace duration and post-grace support procedure.
5. Review operation table foreign keys, row locks, partial unique index, RLS, SECURITY DEFINER ownership, fixed search_path, and service_role-only grants.
6. Add failure-injection tests for lost claim response, lost issue-code response, browser reload before/after Auth update, provider timeout, successful new-password session, and concurrent finalize.
7. Test all RPCs in disposable Postgres before moving any SQL into active migrations.

## 9. Explicit non-changes

This proposal does not alter the legacy recovery migrations or RPCs, create executable SQL, change Supabase data, implement runtime routes, change Gmail OAuth behavior, merge branches, or deploy Production.
