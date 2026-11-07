# Vault Login & Authentication Security Test Plan

**Status:** Approved research plan; execution not yet started  
**Branch:** `feature/vault-authentication`  
**Target:** This repository's own application and isolated test deployments only  
**Production impact:** None. No production credentials, real Gmail accounts, third-party services, or public users are test targets.

## 1. Mission

Continuously test the Vault's own authentication and unlock boundaries, identify weaknesses, implement defensive improvements, and repeat the same tests to verify remediation. A test is not a finding until reproducible evidence exists. A fix is not verified until the original test is repeated against the fixed revision.

The public Security Operations Center is read-only. Test execution, credentials, raw logs, and private lab controls remain private.

## 2. Current security baseline — important limitations

The repository's current design is not yet zero-knowledge:

- The current Vault Master Password is also used as the Supabase Auth password.
- The current browser UI sends account fields to the API as JSON.
- The API encrypts and decrypts account records server-side.
- Browser AES-GCM and DEK-wrapping utilities exist, but the current UI/API flow does not yet use them end-to-end.
- No completed authentication penetration test has established that the login gateway is resistant to attack.

Therefore, do not store high-value real credentials in the current prototype. The first architectural objective is to separate service authentication from client-only vault unlocking.

## 3. Test environment and authorization

Every test run must record:
- Repository and branch/commit SHA.
- Isolated preview or local test environment identifier.
- Synthetic account IDs and fixture version (never real account credentials).
- Test case ID, timestamp, tool/version, expected result, observed result.
- Evidence references with secrets, tokens, personal data, and infrastructure identifiers redacted.
- Cleanup result and any residual test data.

Permitted targets: local test server, isolated test Supabase project, controlled mocks, and explicitly authorized preview deployments. Use synthetic identities and non-production data only. No testing against real Gmail/Google sign-in, unrelated websites, public users, or production infrastructure without a separate written scope and approval.

## 4. Authentication test matrix

| ID | Area | Safe test objective | Expected defensive result |
|---|---|---|---|
| AUTH-01 | Credential validation | Missing, malformed, and incorrect synthetic credentials | Generic denial; no stack trace or secret leakage |
| AUTH-02 | Rate limiting | Controlled repeated failed logins against a local fixture | Bounded attempts, progressive delay or temporary block, observable safe audit event |
| AUTH-03 | Account enumeration | Compare responses for known and unknown synthetic users | No meaningful account-existence disclosure in message or response shape |
| AUTH-04 | Session fixation | Verify session identifier changes after successful authentication | Pre-auth session cannot become authenticated session |
| AUTH-05 | Session expiry | Test idle and absolute expiry using a controllable test clock | Expired sessions are rejected server-side |
| AUTH-06 | Logout/revocation | Reuse a test session after logout/revocation | Server rejects the revoked session |
| AUTH-07 | Cookie policy | Inspect test response cookie attributes | Secure, HttpOnly, appropriate SameSite, narrow Path/Domain |
| AUTH-08 | CSRF/origin | Attempt state changes from an untrusted test origin | Request rejected; same-origin legitimate flow still works |
| AUTH-09 | Redirect handling | Submit untrusted return destinations | Only validated local destinations accepted |
| AUTH-10 | Recovery flow | Exercise expired, reused, malformed, and revoked synthetic recovery material | Fail closed; no account takeover or secret disclosure |
| AUTH-11 | MFA/passkey lifecycle | Test challenge freshness, origin/RP binding, replay, revocation, and fallback policy in a test integration | Invalid/replayed assertions rejected; no silent downgrade |
| AUTH-12 | Authentication/unlock separation | Authenticate without the client unlock secret | Session may access ciphertext only; plaintext remains unavailable |
| AUTH-13 | Authorization/IDOR | Substitute synthetic record IDs across two test users | Cross-owner read/write denied server-side |
| AUTH-14 | Logging and errors | Trigger controlled failures and inspect test logs | No passwords, tokens, recovery codes, plaintext records, or key material logged |

These are planned test cases, not completed test results.

## 5. Vault cryptography and data-boundary tests

| ID | Area | Verification |
|---|---|---|
| CRYPTO-01 | AES-GCM round trip | Correct key and context recover the original synthetic record |
| CRYPTO-02 | Tamper detection | Modified ciphertext or authentication tag fails closed |
| CRYPTO-03 | AAD binding | Wrong vault ID, record ID, type, or format version cannot decrypt |
| CRYPTO-04 | Nonce uniqueness | Automated repeated-encryption test detects accidental nonce reuse in the test sample |
| CRYPTO-05 | DEK envelope | Wrong unlock key, altered envelope, or unsupported version fails closed |
| CRYPTO-06 | KDF bounds | Malformed or excessive stored KDF parameters are rejected before expensive work |
| CRYPTO-07 | Ciphertext-only API | Network inspection confirms plaintext account fields and usable keys are not sent to the API |
| CRYPTO-08 | Storage exposure | Database-only fixture inspection reveals ciphertext and minimum metadata only |
| CRYPTO-09 | Cross-account isolation | RLS and server authorization prevent cross-owner access |
| CRYPTO-10 | Lock lifecycle | Logout, explicit lock, and inactivity remove usable key references as far as the runtime permits |

JavaScript cannot guarantee secure memory zeroization. The residual risk must remain documented.

## 6. Test execution lifecycle

1. **Scope approval:** Confirm owner authorization, target, environment, test window, and stop conditions.
2. **Baseline capture:** Record current commit, configuration, and expected behavior.
3. **Controlled execution:** Run one scoped test case at a time with synthetic fixtures.
4. **Evidence capture:** Save minimal reproducible evidence and redact sensitive values.
5. **Triage:** Classify as confirmed finding, observation, or hypothesis. Assign severity only with a documented impact rationale.
6. **Remediation:** Implement the smallest safe fix with regression tests.
7. **Retest:** Repeat the original case and relevant neighboring cases against the fixed commit.
8. **Review:** Technical review, privacy/security review, bilingual review, and owner approval.
9. **Publication:** Publish only sanitized, approved results with exact commit and test-run provenance.

## 7. Severity and finding rules

- **Critical / High / Medium / Low / Informational:** Severity requires an evidenced impact and realistic threat scenario; do not assign severity from scanner output alone.
- **Confirmed:** Reproduced in the authorized environment with evidence.
- **Observation:** A behavior worth investigating but not yet shown to be exploitable or harmful.
- **Hypothesis:** A suspected weakness without reproduction.
- **Fixed — retest passed:** The original reproducer no longer succeeds and relevant regression tests pass.
- **Unverified fix:** Code changed but the retest has not passed.

Never publish an unpatched, directly exploitable detail that would create avoidable risk. Coordinate disclosure and remediation first.

## 8. Initial engineering priorities

1. Keep the current implementation labeled as a development prototype; do not use real high-value secrets.
2. Inspect the actual auth UI and server routes; map every credential and session data path.
3. Separate Supabase/service authentication from client-only vault unlock. Do not reuse the encryption Master Password as the service login password.
4. Implement a supported authentication design (evaluate passkeys/WebAuthn with a maintained integration; do not write custom signature verification).
5. Add server-side rate limits, generic auth errors, secure session rotation/revocation, CSRF/origin controls, and metadata-only audit events.
6. Complete the client-side encryption/unlock protocol and migrate the API atomically to ciphertext-only behavior with a safe legacy-data plan.
7. Add automated tests from the matrices above and require them in CI before any release.

No production Auth configuration, database migration, production secret, merge to `main`, or production deployment is authorized by this plan.

## 9. Public transparency rules

The public dashboard may show aggregate test counts, approved finding summaries, severity, remediation status, sanitized evidence references, tested commit, and retest status. It must not expose private lab controls, test credentials, tokens, raw sensitive logs, exploitable payloads, personal data, or unpatched operational details.

Do not show fake live attack animations or label planned checks as live tests. Architecture diagrams must be labeled conceptual. A green status is permitted only when a linked test run and review support it.
