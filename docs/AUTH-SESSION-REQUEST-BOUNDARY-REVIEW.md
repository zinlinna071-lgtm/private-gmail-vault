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
