# Authentication Session and Request-Boundary Review

Date: 2026-11-07
Branch: `feature/vault-authentication`
Review type: Source review and mocked route regression tests
Environment: GitHub Actions; no live Supabase project or production session used

## Scope

This follow-up review covers the login, registration, recovery, and logout route request boundaries. It does not claim an end-to-end Supabase session penetration test. All tests use mocked Supabase clients and synthetic request data.

## Source-level observations and changes

### AUTH-SESSION-01 — Logout response previously ignored the Supabase sign-out result

The logout route previously called `supabase.auth.signOut()` and redirected regardless of its returned error. That could make a failed revocation look like a successful logout to the browser.

**Change:** The route now checks the returned error. It redirects only after a successful sign-out call. On failure it returns a generic `503` response, with `Cache-Control: no-store`, and does not claim logout completed.

**Regression tests:** Cross-origin rejection before session access; successful sign-out before redirect; sign-out error returns a non-cacheable failure without redirect.

**Status:** Code changed; CI/retest status must be read from the workflow run for the exact branch commit. This mocked test does not prove the remote Supabase session was invalidated in a real disposable project.

### AUTH-REQUEST-01 — Authentication JSON request bodies were not bounded

The login, registration, and recovery handlers previously used `request.json()` directly. The shared bounded JSON reader already existed, but these three handlers did not use it.

**Change:** These handlers now require the JSON media type, enforce an 8 KiB streamed request-body limit, reject malformed JSON and non-object JSON, and return explicit `413`, `415`, or `400` responses as appropriate. The byte limit is enforced on the stream as well as the optional Content-Length hint.

**Regression tests:** Oversized login body is rejected before calling Supabase authentication; non-JSON registration is rejected before account creation. Existing bounded-reader unit tests cover stream size enforcement and malformed JSON behavior.

**Status:** Code changed; full CI/retest result pending for the latest commit.

## Current authentication limitations

- The Vault Master Password is still also the Supabase Auth password.
- Current Vault record reads still decrypt server-side; the system is not Zero-Knowledge.
- Route tests mock Supabase. Actual cookie rotation, session expiry, refresh, and revocation behavior still require a disposable Supabase project.
- No live database, Supabase Auth configuration, production environment, or production deployment was changed.
- No real user credentials or Gmail accounts were used.

## Next isolated test cases

1. In a disposable Supabase project, sign in with a synthetic account and capture only cookie attributes and non-secret session metadata.
2. Call logout and verify the same session cannot access a protected route afterward.
3. Verify refresh-token reuse and concurrent refresh behavior according to Supabase's supported session model.
4. Verify idle/absolute expiry using test configuration and a controlled clock where possible.
5. Verify sign-out behavior after network timeout or provider error; do not assume the server can prove remote revocation when the response is ambiguous.
6. Record the exact commit, environment, sanitized evidence, and cleanup result.

## Publication rule

These observations are not public vulnerability findings. No research paper or dashboard claim should be published until the relevant behavior is reproduced in an authorized isolated environment, reviewed, and retested after remediation.

### AUTH-SESSION-02 — Supabase SSR refresh middleware was absent

**Source observation:** The app uses Next.js 15.5.6 and `@supabase/ssr`, but the branch had no `middleware.ts` or session-refresh proxy. The server client writes refreshed cookies when possible, but Server Components cannot reliably persist cookie changes. The Vault page and item API handlers independently call `auth.getUser()`; that verifies the user but does not replace the framework-level cookie refresh path.

**Remediation added:** A Next.js 15 `middleware.ts` now creates the Supabase SSR client, calls `auth.getClaims()` to verify/refresh the session, mirrors refreshed cookies into the downstream request, and writes them to the outgoing response. The matcher excludes Next static/image assets, favicon, and common image files. Missing public Supabase configuration fails closed rather than silently skipping session processing.

**Regression coverage added:** Mocked tests assert that claims verification is called, refreshed cookies are present on both the downstream request and browser response, cookie security attributes are retained, and missing configuration fails closed.

**Limitations:** These are mocked middleware tests. They do not prove live Supabase refresh-token rotation, session revocation, cookie expiry, or concurrent refresh behavior. Those require an authorized disposable Supabase project and synthetic accounts. No production Supabase settings or secrets were changed.
