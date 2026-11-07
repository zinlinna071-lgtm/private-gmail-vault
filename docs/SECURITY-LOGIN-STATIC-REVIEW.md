# Vault Login and Data-Access Static Review

**Status:** Preliminary static code review  
**Branch:** `feature/vault-authentication`  
**Review type:** Source inspection only; no live attack or runtime penetration test performed  
**Target:** The application's own authentication and Vault API code  
**Data:** No real credentials or user records used

## Executive summary

The current implementation has several useful controls, including same-origin checks on state-changing browser requests, server-side authentication checks on Vault item routes, per-user database query scoping, bounded JSON parsing, strict input schemas, no-store responses, and a database-backed authentication-attempt limiter.

However, the current Vault is **not Zero-Knowledge**. The server decrypts stored Vault item fields and returns plaintext values to the authenticated browser. The browser-side encryption utilities are not yet the active persistence path.

## Confirmed architecture observations

### OBS-001 — Server-side decryption is the active Vault data path

- **Evidence:** `app/api/vault/items/route.ts` calls `decryptVaultItem(..., user.id, row.id)` in GET and returns the parsed account fields in the JSON response.
- **Impact:** The server runtime and privileged server-side components are within the plaintext trust boundary. A compromise of the application server or privileged runtime could expose decrypted Vault content.
- **Classification:** Architecture limitation; not a demonstrated exploit.
- **Required work:** Design and implement a reviewed client-side encryption migration with a ciphertext-only API. Do not silently migrate existing records or claim Zero-Knowledge before end-to-end verification.

### OBS-002 — Master Password is also the Supabase Auth password

- **Evidence:** `app/api/auth/login/route.ts` calls Supabase `signInWithPassword` using the Vault Login ID-derived internal email and the submitted Master Password. Registration creates the Supabase Auth user with that same password.
- **Impact:** Authentication and encryption unlock are not independent security factors. A future client-side encryption design should separate account authentication from deriving/unwrapping the Vault encryption key.
- **Classification:** Architecture limitation; not a demonstrated exploit.
- **Required work:** Design a separate Vault-unlock flow and recovery model before changing production data or authentication settings.

### OBS-003 — Vault API returns plaintext secrets to the authenticated client

- **Evidence:** `app/api/vault/items/route.ts` decrypts the stored record and returns account name, username, password, and backup codes as JSON. The client renders and manages these values.
- **Impact:** Plaintext necessarily exists in browser memory while the user views or edits records. Browser extensions, compromised devices, malicious injected scripts, or XSS could potentially access values while the Vault is unlocked.
- **Classification:** Expected consequence of the current architecture; no XSS or client compromise was tested.
- **Required work:** Client-side encryption, strict content security controls, minimize plaintext lifetime, clear sensitive UI state on lock/sign-out, and review clipboard behavior.

## Existing controls observed in source

- Login, registration, recovery, recovery acknowledgement, logout, and Vault write routes enforce same-origin request checks.
- Login and registration use a shared database-backed attempt limiter.
- Login returns a generic incorrect-credentials response.
- Vault item reads and writes authenticate through Supabase and scope queries by the authenticated `user.id`.
- Update and delete routes scope item mutations by both record ID and authenticated user ID.
- Vault write routes validate JSON content type, bound request size, and use strict Zod schemas.
- Vault item API responses include no-store cache headers.
- The privileged Supabase client is marked server-only.

These are source-level observations, not proof that the controls behave correctly under runtime attack conditions.

## Priority test cases for the isolated lab

| ID | Test | Safe method | Evidence required |
|---|---|---|---|
| AUTH-01 | Unauthenticated Vault API access | Synthetic test session absent | HTTP status and sanitized response |
| AUTH-02 | Cross-account item access | Two synthetic users and seeded records | Confirm user B cannot read/update/delete user A's record |
| AUTH-03 | Same-origin enforcement | Mocked foreign Origin and Fetch Metadata headers | Rejection before state mutation |
| AUTH-04 | Login throttling | Synthetic account and controlled test IP | Counter state, response code, reset behavior |
| AUTH-05 | Account enumeration | Compare registration/recovery responses for synthetic IDs | Response body/status/timing distribution |
| AUTH-06 | Session lifecycle | Synthetic session rotation, expiry, logout | Cookie attributes and post-logout access result |
| AUTH-07 | Recovery replay/race | Concurrent synthetic recovery attempts | Exactly one valid claim and safe final state |
| DATA-01 | Ciphertext storage | Seed synthetic Vault item | Database contains ciphertext, not plaintext |
| DATA-02 | Cross-user isolation | Synthetic user A/B | No cross-user data exposure |
| DATA-03 | Plaintext boundary | Instrument test browser and API | Identify every point where plaintext exists |
| DATA-04 | Client encryption readiness | Unit tests with synthetic keys/data | Tamper rejection, AAD binding, nonce behavior |

## Important review questions before claiming a finding

1. Does the production hosting proxy provide trustworthy client-IP headers for the rate limiter? Verify configuration rather than assuming header authenticity.
2. Are all deployed database migrations present and current for the rate-limit and recovery RPC functions?
3. Are Supabase Auth cookie flags, session lifetime, refresh behavior, and session revocation configured as intended?
4. Does the application enforce a restrictive Content Security Policy and avoid unsafe script execution?
5. Can the recovery claim/finish/release workflow recover safely from partial failure and concurrent requests?
6. Are sensitive fields excluded from all logs, traces, error reporting, and analytics?

## Publication policy

No vulnerability is marked confirmed from this static review alone. A public research paper must link each confirmed finding to an isolated test run, tested commit, runtime/environment, reproducible safe methodology, sanitized evidence, remediation, and successful retest. Unverified observations remain clearly labeled as observations or hypotheses.

## Safety and scope

- Only test this application's isolated lab or explicitly authorized preview environment.
- Use synthetic accounts and synthetic secrets.
- Do not attack third-party services, real Gmail accounts, production users, or infrastructure outside the approved scope.
- Do not publish credentials, tokens, raw sensitive logs, or exploit details that would enable attacks against others.
- No production configuration, database migration, deployment, or branch merge is authorized by this review.
