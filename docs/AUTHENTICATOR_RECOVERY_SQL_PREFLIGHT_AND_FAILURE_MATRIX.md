# Authenticator Recovery SQL Preflight and Failure Matrix

**Status:** Review document only. Not executable SQL. No database changes authorized.
**Branch:** `feature/vault-authentication`

## 1. Repository facts checked

- The active legacy migration `supabase/migrations/202611060003_recovery_claims.sql` adds claim and pending Recovery Code fields directly to `public.vault_profiles`.
- That migration defines the legacy RPCs `claim_vault_recovery`, `finish_vault_recovery`, `acknowledge_vault_recovery_code`, and `release_vault_recovery`.
- The legacy acknowledgement RPC promotes only `recovery_code_hash` and `recovery_code_salt`; it does not promote a matching Authenticator VDK recovery wrapper. It must not be used to finalize the new Authenticator recovery generation.
- The proposed Authenticator envelope draft is `docs/sql-drafts/202611060004_authenticator_vault.sql`. It creates `vault_key_envelopes` and `vault_auth_factors`, but is not an active migration.
- The API contract and RPC contract are design documents. No Authenticator recovery route or recovery-operation SQL has been authorized or implemented by these documents.

## 2. Dependency and compatibility checks still required

The proposed operation table references `vault_key_envelopes(user_id)`. Therefore it can only be created after the envelope table exists. The operation table must also bind the same `user_id` to the existing `vault_profiles` row used for the active Recovery Code verifier.

Before executable SQL is drafted, inspect the repository's complete schema history and verify:

1. Exact `vault_profiles.user_id` type, primary/unique key, and FK to `auth.users`.
2. Whether every Vault user guaranteed to have an envelope also has a `vault_profiles` row.
3. Exact Recovery Code hash/salt algorithm, encoding, and verification implementation used by the current server routes.
4. Whether the current profile table has RLS, triggers, grants, or policies that affect service-role RPC behavior.
5. Exact `vault_key_envelopes` column names in the draft and whether any other branch changes them.
6. Whether `public.set_updated_at()` exists in the target schema before adding a trigger to the new table.
7. Supported Postgres/Supabase version and function semantics for row locking, partial unique indexes, SECURITY DEFINER ownership, and grants.

Do not infer these details from the legacy recovery migration alone. Do not modify the legacy migration to make the new protocol fit.

## 3. Required operation-table invariants

- One open operation per user, protected by a partial unique index over non-terminal states.
- Every operation is tied to one active envelope version and one owner.
- The claim handle is generated with cryptographically secure randomness; store only a keyed verifier/hash and compare safely.
- Server-generated Recovery Code verifier is immutable after issue-code succeeds.
- The temporary encrypted Recovery Code response copy is server-key encrypted, bound with AAD to user ID + operation ID + purpose + schema version, and expires no later than the operation.
- Pending wrappers and pending verifier remain inactive until finalization.
- Terminal cleanup clears all pending ciphertext, IV/tag, verifier, and claim verifier.
- No direct table access for anon/authenticated browser roles.
- All SECURITY DEFINER functions use a fixed search path, explicit argument validation, narrow grants, and no dynamic SQL.
- All version-sensitive writes use row locks plus expected-version compare-and-swap. A version column by itself is not concurrency control.

## 4. Recovery state transition matrix

| Current state | Operation | Required checks | Next state |
|---|---|---|---|
| none | claim | current code verified, active envelope exists, expected version matches, no open operation | claimed |
| claimed | issue-code | owner + claim + lease valid; generate code and verifier on server | code_issued |
| code_issued | issue-code retry | same operation; encrypted retry copy still valid | code_issued; return same code |
| code_issued | stage wrappers | owner + claim + lease + version; strict crypto metadata; no client verifier | wrappers_staged |
| wrappers_staged | Auth update begins | same operation and payload fingerprint | wrappers_staged / in_progress |
| wrappers_staged | Auth update confirmed | provider confirms update | staged |
| wrappers_staged | Auth update fails | keep pending material inactive; record recoverable failure | wrappers_staged / failed |
| staged | finalize | newly authenticated owner, operation matches, lease/version valid, Auth update attested | finalized |
| any open state | abandon | owner + claim valid | abandoned |
| any open state | expiry cleanup | expires_at <= now() | expired |

The state stored in Postgres must never claim the Auth password was updated merely because the browser requested an update. A server-confirmed provider result or a newly authenticated session established with the new password is required.

## 5. Cross-system password-update saga: crash recovery

Supabase Auth and Postgres do not share a transaction. The implementation must explicitly handle these crash points:

1. **Before pending wrappers are stored:** active generation remains unchanged; retry stage.
2. **After wrappers are stored, before Auth update:** operation remains `wrappers_staged`; retry the same operation.
3. **After marking Auth update in progress, before provider update:** operation remains recoverable; retry same operation.
4. **Provider update fails definitively:** mark failure; pending generation remains inactive.
5. **Provider updates password but response is lost:** database may still say `in_progress`. Do not assume failure and do not issue another Recovery Code. The user should attempt sign-in with the new password. A successful new Vault session for the same user is server-verifiable evidence that the Auth password update succeeded; the authenticated finalize route may record this attestation and proceed, subject to operation/version checks.
6. **Provider update succeeds and server records staged:** user signs in with the new password, then finalizes.
7. **Postgres finalization commits but HTTP response is lost:** retry status/finalize as the authenticated owner; return the already finalized outcome and do not increment the envelope version again.
8. **Operation expires before finalization:** do not promote pending wrappers. Preserve active envelope/profile generation. If Auth password was already changed, the user must still be able to sign in with the new password and use a separately designed safe restart/reconciliation path. Do not silently reset Auth password or rotate the active Recovery Code.

The exact policy for case 8 is a blocking design decision: operation expiry must not strand the account with a changed Auth password and an unusable Authenticator envelope. Consider a bounded post-Auth-update finalization grace period or a distinct recoverable state that cannot be cleaned up until reconciled. Never simply delete an operation whose Auth update may already have succeeded.

## 6. Failure-injection and concurrency tests

### Claim and issue-code

- Wrong Recovery Code: generic failure; no operation created.
- Concurrent claim requests: exactly one open operation.
- Stale envelope version: claim rejected.
- Lost issue-code response: same operation returns the same code while encrypted retry copy is valid.
- Expired retry copy: no new code is silently issued under the same operation; require a documented restart path.
- Cross-user operation ID/claim handle: rejected without revealing whether another user's operation exists.

### Wrapper staging

- Missing ciphertext, IV, tag, KDF name/version/salt/parameters: rejected.
- KDF parameters outside strict allowlist: rejected server-side.
- Wrong expected envelope version: rejected.
- Identical payload retry: same result.
- Conflicting payload fingerprint: rejected.
- Client-supplied verifier fields: rejected as unknown request fields.

### Supabase Auth saga

- Provider rejects password update: pending wrappers remain inactive.
- Provider success then process crash: new-password sign-in reconciles the operation.
- Provider response timeout: no second Recovery Code and no new operation.
- Auth session belongs to a different user: cannot mark the operation successful or finalize.
- Expiry while Auth result is ambiguous: operation is retained/reconciled safely; no blind cleanup.

### Finalization

- Wrong user, operation, claim, state, or expected version: rejected.
- Missing any wrapper/verifier field: transaction rolls back.
- Inject failure after each promotion statement: all Postgres changes roll back.
- Two concurrent finalizers: one promotion and one envelope version increment.
- Response lost after commit: retry returns finalized result without another increment.
- Legacy recovery acknowledgement RPC is never called.
- Finalized/abandoned/expired operation has no pending secrets or encrypted Recovery Code copy.

### Cleanup

- Cleanup touches only expired open operations that are safe to expire.
- It never changes active envelope wrappers or active profile verifier.
- It never expires an operation that is in an unresolved post-Auth-update state without a documented reconciliation policy.
- Repeated cleanup is idempotent.

## 7. Current blockers before executable SQL or runtime work

1. Verify complete schema history and exact profile/envelope relationships.
2. Decide and document post-Auth-update expiry/reconciliation behavior.
3. Specify authenticated-session attestation for the ambiguous provider-response case.
4. Define idempotency behavior for claim response loss and expired issue-code retry copy.
5. Finalize claim-handle hashing, encrypted retry-copy AAD, and payload fingerprint canonicalization.
6. Review every SQL function signature against actual route call sites before implementation.
7. Run SQL only in a disposable test database after review; never in the user's active Supabase project at this stage.

## 8. Explicit non-changes

This review does not alter `supabase/migrations/**`, active Supabase data, runtime routes, Gmail behavior, legacy recovery RPCs, `main`, or Production.
