# Legacy Recovery Failure-Window Audit

Status: code inspection only. No runtime code, database, or credentials changed.

## Scope
Reviewed `app/api/auth/recovery/route.ts` on `feature/vault-authentication` against the disposable Auth test plan.

## Confirmed sequence
1. The route claims the legacy recovery operation.
2. It calls Supabase Admin `updateUserById` to change the password.
3. It generates and encrypts the replacement Recovery Code.
4. It calls `finish_vault_recovery` to persist the pending replacement code.
5. It attempts `signInWithPassword` after the database finish operation.

## Critical failure window
The `finally` block calls `release_vault_recovery` whenever `recoveryFinished` is false. That includes the case where the Auth password update succeeded but `finish_vault_recovery` failed or returned a non-true result. The provider credential may therefore have changed while the legacy claim is released and no durable pending replacement Recovery Code is confirmed.

This is a confirmed code-path risk, not proof that a live account has encountered it. Do not reuse this release behavior in the new recovery workflow.

## Additional observations
- The route creates the replacement Recovery Code only after the provider password update. A process crash after provider success but before code creation can leave no durable replacement code to retrieve.
- The existing pending-code retry path checks sign-in with the new password and returns the stored encrypted code, but it applies only when a valid pending record already exists.
- The current flow does not establish an atomic transaction spanning Supabase Auth and the Vault database; these are separate systems.
- The broad catch returns an exception message to the client. Review error redaction before treating this endpoint as hardened.

## Required design rule
Once a provider credential update may have started, preserve the operation as in-progress/ambiguous until reconciliation establishes the outcome. Do not clear its claim or pending recovery material solely because finalization failed or a lease elapsed. Finalization must be retryable, owner-bound, and idempotent.

## Next verification
Use only a disposable Supabase project and synthetic user to test provider update retry behavior, response-loss ambiguity, and successful password update followed by failed session creation. Do not test against the active Vault project.

## Non-changes
No source code, migrations, RPCs, active Supabase project, Gmail account, Main branch, or Production deployment was changed.
