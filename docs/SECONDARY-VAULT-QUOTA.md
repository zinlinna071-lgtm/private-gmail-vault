# Secondary Vault Record Quota

**Status:** Implemented in branch source; PostgreSQL execution still pending CI verification.  
**Branch:** `design/cyber-visual-architecture`  
**Production impact:** None. The migration has not been applied to any Supabase database.

## Policy

- A Secondary account may store at most four credential records in its own Vault.
- A Master/Owner account is exempt from this Secondary quota.
- The quota applies to record creation, not the number of Secondary accounts a person may provision.
- Every record remains scoped to the authenticated user's immutable Supabase user ID.
- The public registration endpoint does not accept an account type from the browser. New profiles inherit the database default `secondary`.
- Owner status is privileged and must be provisioned out-of-band by an authorized operator after independent identity verification. Never expose a public role-selection or role-promotion endpoint.

## Enforcement design

Migration: `supabase/migrations/202611080002_secondary_vault_record_quota.sql`

1. Adds `vault_profiles.account_type`, defaulting all existing and newly inserted profiles to `secondary`.
2. Restricts values to `secondary` or `owner`.
3. Defines the service-role-only `create_vault_item_with_quota(...)` database function.
4. Locks the corresponding `vault_profiles` row with `SELECT ... FOR UPDATE` before counting records and inserting.
5. Rejects a Secondary insert when four rows already exist.
6. Allows Owner inserts without this four-record check.
7. Revokes direct `INSERT` privilege on `vault_items` from `service_role`, so application inserts must use the quota function.
8. Keeps the ordinary server API's user-scoped read, update, and delete paths separate.

The profile-row lock serializes concurrent creates for the same user. Two requests competing for the fourth slot cannot both pass the count check: the second waits for the first transaction, then observes the committed fourth record and is rejected.

The API route calls the database function and maps the specific quota error to HTTP 409. It does not rely on a browser-side count or disabled button.

## Tests added

- `tests/vault-access-routes.test.ts`: route calls the quota RPC and maps the quota error to HTTP 409.
- `supabase/tests/secondary_vault_record_quota.sql`: checks four-record enforcement, Owner exemption, and the service-role insert privilege boundary.
- `scripts/test-secondary-vault-quota.sh`: creates minimal fixtures in a disposable PostgreSQL database, applies only this migration, runs SQL assertions, and races two inserts for one remaining slot.
- `.github/workflows/ci.yml`: runs the new disposable-database test script and reports its outcome.

The tests are defined but are **not yet confirmed passing**. The current GitHub Actions runner-allocation issue must be resolved before claiming the PostgreSQL tests passed.

## Important boundaries and remaining work

- This migration is source code only. It has not been applied to production or any connected Supabase database.
- Existing Owner profiles, if any, are not automatically promoted. The default is intentionally Secondary. Before a future approved migration, identify the intended Owner account using a trusted out-of-band process and plan a narrowly scoped role assignment. Do not infer Owner status from a Login ID, email, browser field, or public claim.
- The quota function only governs inserts through the privileged application path. Keep direct table INSERT revoked from the service role and review all future server-side write paths.
- The current Vault API still receives plaintext credential fields and decrypts records server-side. The quota work does **not** make the Vault zero-knowledge and does not prevent a sufficiently privileged server operator from accessing plaintext through the legacy path.
- Owner/server inability to decrypt Secondary records remains an unachieved target until the client-side key hierarchy, ciphertext-only API, browser UI, legacy migration, recovery, and independent review are complete.

Do not apply this migration to a live database without explicit approval after reviewing the actual target database and its migration history.
