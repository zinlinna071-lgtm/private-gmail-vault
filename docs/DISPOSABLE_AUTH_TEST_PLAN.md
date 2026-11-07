# Disposable Auth Test Plan

Status: planning only. No external project or account was accessed.

## Scope
Use a separate disposable Supabase project and a synthetic user only. Never use the active Vault project, real Gmail accounts, production data, or secrets in source control.

## Repository facts
The legacy route at `app/api/auth/recovery/route.ts` calls the server-side Admin API to change the credential, then separately calls `signInWithPassword`. These are separate operations. The manifest declares `@supabase/supabase-js` `^2.57.4` and `@supabase/ssr` `^0.7.0`; no root npm, pnpm, or Bun lockfile was found, so the resolved SDK version is unknown.

## Test sequence
1. Create a disposable project and synthetic user.
2. Record region, test date, package manager, and resolved SDK versions from `npm ls @supabase/supabase-js @supabase/ssr`.
3. Confirm the initial sign-in works.
4. Change the synthetic user's credential and separately verify the new sign-in.
5. Attempt the same update again and record the exact provider result; do not assume retry semantics.
6. Verify whether the previous credential is rejected.
7. Simulate application response loss after an awaited provider success by discarding the result and restarting the test process; verify sign-in in a new process.
8. Simulate a crash before the provider request and verify the existing credential remains valid.
9. Dispatch a request without awaiting it, then test both credentials; classify the outcome as ambiguous if not conclusive.
10. Simulate successful provider update followed by failed session creation; record both outcomes separately.

## Evidence
For each case record test ID, UTC time, redacted project reference, region, SDK versions, sanitized provider error code/message, and which synthetic credential succeeds. Never record credentials, API keys, session tokens, recovery codes, or raw secret-bearing responses.

## Separate database tests
Claim retries, duplicate claims, concurrent finalization, cross-user isolation, and pending-record cleanup require a separate disposable database implementation. Do not run them against the active Vault database.

## Gate
Do not implement the recovery saga until provider retry/lost-response behavior is observed in the disposable project, same-user new-session reconciliation is verified, pending encrypted wrappers are durable before the provider call, and finalization is atomic and idempotent.

## Non-changes
This plan does not create a Supabase project, call Auth APIs, create test users, alter runtime code, run migrations, touch the active database, merge branches, or deploy Production.
