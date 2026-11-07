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

### AUTH-SESSION-03 — Session lifetime and revocation settings remain unverified

**Source observations:**
- The app does not define an explicit Supabase cookie `cookieOptions` override in its server client helper. Cookie serialization is delegated to `@supabase/ssr`.
- No repository configuration establishes Supabase project-level access-token lifetime, inactivity timeout, maximum session lifetime, or single-session policy.
- The logout handler calls `supabase.auth.signOut()` and now reports failure rather than redirecting as if logout succeeded.
- The Vault page and each Vault item API handler verify the current user server-side. Item reads and mutations are scoped to that verified user ID.

**Status:** These controls are present in source, but actual cookie flags, configured session timeouts, refresh-token reuse handling, and cross-device revocation behavior cannot be established from this repository alone.

**Next authorized test:** Use a disposable Supabase project with synthetic users. Record cookie names and attributes without recording token values; inspect configured session timeouts; test expiry, logout, refresh-token rotation, parallel refresh, and post-logout access. Do not change production Auth settings as part of this review.


### AUTH-SESSION-04 — Middleware scope and authenticated response caching

**Source observation:** The first middleware revision ran for every dynamic route, including public Security, Research, Support, and SEO endpoints that do not use Supabase Auth. It also did not explicitly mark matched Vault responses as non-cacheable.

**Remediation added:** The matcher is now limited to `/vault/:path*` and `/api/vault/:path*`. Every matched response is marked `Cache-Control: private, no-store` and `Pragma: no-cache`, including responses where no token refresh occurs. When refreshed cookies are written, the replacement response receives the same cache policy before the cookies are attached.

**Regression coverage added:** Middleware tests assert the private/no-store policy for refreshed and ordinary Vault responses and assert the route matcher is restricted to the authenticated Vault UI/API.

**Limitations:** These are unit tests using mocked Supabase behavior. They do not validate CDN behavior in a deployed environment. The public pages are not expected to invoke this middleware after the matcher change; a real deployment check remains outstanding.

### Dependency reproducibility note

The repository declares `@supabase/ssr` as `^0.7.0` and the inspected branch contains no npm, pnpm, Yarn, or Bun lockfile. CI currently runs `npm install`, so dependency resolution is not pinned to a committed lockfile. This is a supply-chain reproducibility gap, not evidence of a known exploitable dependency. A lockfile should be generated and reviewed in a controlled dependency-update change before relying on repeatable installs.

**Verification status:** CI run `42295821623` passed on the pre-follow-up commit `b3bafcbc96c967d17495458929bf39850b3d5465`. The middleware scope/cache changes are newer and must be verified by CI on their exact resulting commit before being marked passed. No production deployment or Supabase project configuration was changed.

**Reference:** Supabase SSR guide — https://supabase.com/docs/guides/auth/server-side/creating-a-client
