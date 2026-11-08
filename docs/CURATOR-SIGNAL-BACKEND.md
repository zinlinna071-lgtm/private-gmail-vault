# The Curator's Signal — Backend Integration

**Status:** Server-side challenge and one-time registration-claim code is committed on `design/cyber-visual-architecture`; database migration and runtime verification are still pending.

## Flow

1. The public challenge page calls `GET /api/curator/challenge`.
2. The server creates (or reuses) an opaque browser-session cookie, generates a fresh random challenge token, and stores only SHA-256 hashes of the challenge and session in `curator_challenges`.
3. The raw challenge token is returned only in an HttpOnly, SameSite=Strict cookie. The challenge row expires after ten minutes.
4. The browser submits the discovered marks and four-ring order to `POST /api/curator/verify`.
5. The server validates the exact expected mark set and order, then calls `consume_curator_challenge`. The database atomically consumes the challenge only when its hash, session hash, expiry, and unused state all match.
6. After successful challenge consumption, the server creates a random registration claim. Only its SHA-256 hash and the browser-session hash are stored in `curator_registration_claims`; the raw claim is returned only as an HttpOnly cookie.
7. Registration requires the existing responsibility acknowledgement and the claim/session cookies. It calls `consume_curator_registration_claim`, another atomic database function. The claim must be unexpired, match the browser session, and be unused.
8. After the server consumes the claim, it creates an ordinary Secondary account. Client-supplied role or Owner flags are ignored; Master/Owner Research Lab access is independently allowlisted by `SECURITY_RESEARCH_OWNER_USER_ID`.

## Required database setup

Apply `supabase/migrations/202611080001_curator_registration_claims.sql` to the project's Supabase database before enabling this flow. The migration has **not** been applied to any Supabase database. It creates the challenge and registration-claim tables with RLS enabled and no anon/authenticated grants, plus service-role-only atomic consume functions. A disposable PostgreSQL test runner has been added to CI; it does not connect to or mutate the project's Supabase instance.

Do not run this migration against production without the owner's explicit approval. Until it is applied to the intended environment, challenge bootstrap or verification will return a temporary service error because the required table or function is unavailable.

## Security boundaries and limitations

- The Curator puzzle is a public discovery experience, not an identity check or authentication factor: its answer is present in public client code and can be automated or reproduced. However, completing it is a mandatory **server-verified registration gate** for creating a Secondary account. The gate issues only a short-lived, session-bound, one-time registration claim; it never grants a signed-in session, Vault record access, or Master/Owner privileges.
- Challenge and claim tokens are generated with cryptographically secure randomness. Only SHA-256 hashes are stored in the database; raw values are delivered in HttpOnly cookies.
- Challenge consumption is server-side and atomic. A challenge must match the browser-session hash, be unexpired, and be unused. Replaying it or presenting it with a different session fails.
- Registration claims are also server-side, session-bound, short-lived, and atomically one-time. They do not grant Owner privileges.
- The existing rate limiter uses trusted proxy IP information and a session-derived bucket. It is abuse friction, not a substitute for authentication or a durable identity check.
- Public registration must continue to assign the Secondary role server-side. Never accept a role from the browser.
- Registration still requires the separate responsibility acknowledgement.
- The challenge is consumed before the registration claim is inserted. If claim insertion fails, the user must start a fresh challenge.
- The registration claim is consumed before Supabase account creation. If account creation subsequently fails, the user must solve the puzzle again.
- Claim issuance and registration rely on the existing Supabase admin credentials and rate-limit RPC being configured.
- Expired/consumed rows can be pruned periodically; no cleanup job is included yet.

## Verification checklist

- [ ] Apply migration in a non-production test environment.
- [ ] Load the challenge and confirm the session/challenge cookies are HttpOnly, SameSite=Strict, and Secure on HTTPS.
- [ ] Confirm only challenge/session hashes are stored in `curator_challenges`.
- [ ] Submit an incorrect mark set/order; expect HTTP 422 and no claim.
- [ ] Submit a valid solution; expect the challenge to be atomically consumed and a claim cookie issued.
- [ ] Replay the same challenge; expect rejection and no second claim.
- [ ] Try a challenge with a different session or expired challenge; expect rejection.
- [ ] Attempt registration without consent; expect HTTP 428 and no account.
- [ ] Attempt registration without a claim; expect HTTP 428 and no account.
- [ ] Attempt registration with a mismatched session, expired claim, or reused claim; expect rejection and no account.
- [ ] Confirm a second use of the same claim fails, including concurrent attempts.
- [ ] Confirm every public registration is Secondary regardless of client-supplied fields.
- [ ] Run automated tests, typecheck, both PostgreSQL migration test scripts, and production build; inspect CI results before any preview.

No production database, Main branch, or deployment has been changed by this implementation.

## Automated test coverage added

The design branch now includes deterministic Vitest coverage for:
- challenge bootstrap rejection for an explicit cross-site request;
- PostgreSQL migration permission checks, RLS checks, session/expiry/replay rejection, and concurrent one-time challenge and registration-claim consumption in an isolated CI database;
- no-store response and HttpOnly, SameSite=Strict session/challenge cookie attributes;
- reuse of the browser session while rotating and persisting the challenge marker;
- failure closed when challenge persistence is unavailable;
- exact Curator archive mark and four-ring order validation, including missing, extra, duplicate, malformed, and incorrect values;
- verification API behavior for invalid answers, replayed/invalid challenge, successful atomic challenge consumption, hashed claim issuance, and database failures;
- generation of opaque 256-bit claim tokens and SHA-256 digest properties;
- registration rejection when the responsibility acknowledgement or Curator claim is missing;
- rejection when the atomic claim-consume RPC reports a mismatched, expired, or previously consumed claim;
- successful registration invoking the atomic consume RPC with hashed claim/session values and clearing the raw claim cookie.

Test files:
- `tests/curator-challenge-route.test.ts`
- `supabase/tests/curator_registration_claims.sql`
- `scripts/test-curator-registration-migration.sh`
- `tests/curator-puzzle.test.ts`
- `tests/curator-claim.test.ts`
- `tests/curator-verify-route.test.ts`
- updated `tests/auth-routes.test.ts`

These tests and the isolated PostgreSQL runner have been added to the repository but have **not yet been executed in a confirmed CI or local test run**. The Vercel status check is currently failing because the linked Vercel account reports a build-rate-limit/upgrade restriction; that is not evidence of a GitHub Actions test failure. Do not describe the test suite as passing until a successful run is observed.
