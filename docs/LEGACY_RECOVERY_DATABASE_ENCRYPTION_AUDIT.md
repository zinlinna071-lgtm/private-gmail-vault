# Legacy Recovery Database and Encryption Audit

Status: static inspection only. No database was queried or modified.

## Scope
Reviewed:
- `supabase/migrations/202611060002_vault_auth_credentials.sql`
- `supabase/migrations/202611060003_recovery_claims.sql`
- `lib/auth/recovery-encryption.ts`

## Confirmed design
- Recovery claims and pending-code operations are restricted to `service_role`; anon and authenticated roles are explicitly revoked.
- The active Recovery Code hash remains unchanged until the pending code is acknowledged.
- Pending Recovery Code material is stored as a scrypt verifier plus AES-256-GCM ciphertext, IV, and authentication tag.
- Claim lease is constrained to 60–1800 seconds; pending code expiry is constrained to at most 25 hours.

## Risks and limitations
1. The legacy release RPC clears the claim based only on user ID and claim token. It does not know whether the external Supabase Auth password update may already have succeeded. Application code must not call it after the provider update may have started unless the outcome is definitively known to be failed.
2. The claim RPC can replace an expired claim and clears expired pending-code fields. This is acceptable only for the legacy flow's known states; it is not a safe state machine for an ambiguous external Auth operation.
3. AES-256-GCM encryption currently supplies no additional authenticated data (AAD). Ciphertext integrity is authenticated, but the encrypted payload is not cryptographically bound to a user, operation, purpose, or schema version. The new design should bind these values as AAD and version the envelope.
4. The encryption key is a single server environment secret. Rotation/versioning and recovery behavior for key rotation are not described in the current helper.
5. The SQL functions are SECURITY DEFINER with a fixed `search_path = public`, and execution is service-role-only. Before any new migration, independently review function ownership, schema qualification, grants, RLS, and cross-user constraints.

## Required changes for a future implementation
- Do not modify or repurpose the legacy migration/RPCs in place.
- Build a separate operation state machine with durable `not_started`, `in_progress`, `updated`, and reconciliation-required states.
- Never let ordinary lease expiry clear an operation after Auth update may have started.
- Make finalization idempotent and owner-bound.
- Add AAD containing at minimum user ID, operation ID, purpose, and envelope schema version.
- Define explicit encryption-key versioning and rotation before storing new encrypted recovery material.

## Non-changes
No source code, SQL migration, Supabase project, Auth API, Gmail account, Main branch, or Production deployment was changed.
