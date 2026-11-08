# The Curator's Signal — Backend Integration

**Status:** Backend implementation committed on `design/cyber-visual-architecture`; database migration and runtime verification are still pending.

## Flow

1. The public challenge page calls `GET /api/curator/challenge`.
2. The server creates (or reuses) an opaque browser-session cookie and issues a short-lived, HttpOnly challenge cookie. Both use `SameSite=Strict`; cookies are Secure in production.
3. The browser submits the discovered marks and four-ring order to `POST /api/curator/verify`.
4. The server checks the exact expected mark set and ordering, enforces the existing database-backed auth rate limiter, and creates a random claim.
5. Only a SHA-256 hash of the claim and browser-session token are stored in `curator_registration_claims`. The raw claim is returned only as an HttpOnly cookie.
6. Registration requires both the existing responsibility acknowledgement and the claim/session cookies.
7. Registration calls `consume_curator_registration_claim`, an atomic database function. The claim must be unexpired, match the browser session, and be unused. A successful consume permanently marks it used.

## Required database setup

Apply `supabase/migrations/202611080001_curator_registration_claims.sql` to the project's Supabase database before enabling this flow. The migration has **not** been applied by this code change. It creates a table with RLS enabled and no anon/authenticated grants, plus a service-role-only atomic consume function.

Do not run this migration against production without the owner's explicit approval. Until it is applied to the intended environment, puzzle verification will return a temporary service error because the claim table does not exist.

## Security boundaries and limitations

- The Curator puzzle is a public discovery ritual and abuse-friction layer, **not an authentication factor or security boundary**. Its answer is part of public client code and can be automated or reproduced.
- The claim is a short-lived, one-time registration gate bound to the browser session; it does not grant Owner privileges.
- Public registration must continue to assign the Secondary role server-side. Never accept a role from the browser.
- Registration still requires the separate responsibility acknowledgement.
- The claim is consumed before Supabase account creation. If account creation subsequently fails, the user must solve the puzzle again.
- Claim issuance and registration rely on the existing Supabase admin credentials and rate-limit RPC being configured.
- Expired/consumed rows can be pruned periodically; no cleanup job is included yet.

## Verification checklist

- [ ] Apply migration in a non-production test environment.
- [ ] Load the challenge and confirm the session/challenge cookies are HttpOnly, SameSite=Strict, and Secure on HTTPS.
- [ ] Submit an incorrect mark set/order; expect HTTP 422 and no claim.
- [ ] Submit the correct solution; expect a claim cookie and a stored hash (never a raw claim).
- [ ] Attempt registration without consent; expect HTTP 428 and no account.
- [ ] Attempt registration without a claim; expect HTTP 428 and no account.
- [ ] Attempt registration with a mismatched session, expired claim, or reused claim; expect rejection and no account.
- [ ] Complete the puzzle, accept the notice, and register; expect the claim to be consumed once.
- [ ] Confirm a second use of the same claim fails, including concurrent attempts.
- [ ] Confirm every public registration is Secondary regardless of client-supplied fields.
- [ ] Run automated tests, typecheck, and production build; inspect CI results before any preview.

No production database, Main branch, or deployment has been changed by this implementation.

## Automated test coverage added

The design branch now includes deterministic Vitest coverage for:
- exact Curator archive mark and four-ring order validation, including missing, extra, duplicate, malformed, and incorrect values;
- generation of opaque 256-bit claim tokens and SHA-256 digest properties;
- registration rejection when the responsibility acknowledgement or Curator claim is missing;
- rejection when the atomic claim-consume RPC reports a mismatched, expired, or previously consumed claim;
- successful registration invoking the atomic consume RPC with hashed claim/session values and clearing the raw claim cookie.

Test files:
- `tests/curator-puzzle.test.ts`
- `tests/curator-claim.test.ts`
- updated `tests/auth-routes.test.ts`

These tests have been added to the repository but have **not yet been executed in a confirmed CI or local test run**. The Vercel status check is currently failing because the linked Vercel account reports a build-rate-limit/upgrade restriction; that is not evidence of a GitHub Actions test failure. Do not describe the test suite as passing until a successful run is observed.
