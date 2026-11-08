# Vault Threat Model and Security Requirements

**Status:** Draft design review — not an implementation or certification  
**Branch:** `design/cyber-visual-architecture`  
**Date:** 2026-11-08  
**Scope:** Private Account Vault account credentials, encrypted record storage, browser unlock/decryption, authenticated APIs, migration, and operational evidence.

> This document describes threats and proposed controls. It does not claim that the proposed client-side encryption architecture is implemented. Current production and branch behavior remains server-mediated encryption unless a separately approved implementation changes it.

## 1. Security objectives

1. Confidentiality of passwords, backup codes, and account identifiers at rest and in transit.
2. Server-side storage and API operators should not be able to decrypt record contents in the proposed zero-knowledge design.
3. A user must only access records belonging to their authenticated Vault.
4. Cryptographic tampering, record substitution, and cross-Vault substitution must fail closed.
5. Unlock, lock, logout, session expiry, and account switching must have explicit key and UI state transitions.
6. Recovery and migration must not silently weaken confidentiality or cause unrecoverable data loss.
7. Public dashboards, logs, analytics, and research papers must never disclose credentials, keys, plaintext payloads, or private identifiers.
8. Security claims must be supported by reproducible tests and independent review.

## 2. Assets and trust boundaries

| Asset | Security requirement | Current observation |
|---|---|---|
| Passwords and backup codes | Confidentiality and integrity | Current API decrypts server-side and returns plaintext to the browser |
| Account names and usernames | Metadata confidentiality | Currently returned in plaintext with the collection |
| Ciphertext and IV/tag | Integrity and correct record binding | Server-side encryption currently used by collection API |
| Vault data-encryption key (DEK) | Never exposed to server in target design | Client key-envelope helper exists; not integrated into API/UI |
| Key-encryption key (KEK) | Derived locally, non-extractable where supported | Helper accepts 32-byte derived material; Argon2id adapter is separate |
| Auth session | Authentication and authorization | Supabase Auth session used by current API |
| Browser memory and clipboard | Minimize exposure; no false erasure claims | Plaintext collection remains in mounted client state; clipboard is OS-managed |
| Recovery material | Availability without a server decryption bypass | Recovery design remains open |
| Public evidence and logs | No sensitive content | Logging policy must be enforced across all routes and services |

Trust boundaries:
- User device and browser.
- Public application delivery/CDN and JavaScript bundle.
- Authentication provider and session.
- Application API runtime.
- Database, backups, and operational logs.
- Browser extensions, other local applications, and operating system clipboard.
- Public read-only security and research surfaces.

## 3. Threat scenarios and required controls

### T1 — Database or backup disclosure

**Threat:** An attacker obtains database rows or backups.

**Current exposure:** Server-side ciphertext is stored, but the server retains the ability to decrypt it through its configured encryption key.

**Target controls:**
- Encrypt record fields in the browser with a random per-Vault or per-record data key, with a documented key hierarchy.
- Store only ciphertext, versioned envelope metadata, and non-sensitive operational fields.
- Keep the user-derived KEK and unwrapped DEK out of server requests and server logs.
- Bind encrypted values to Vault ID, record ID, field purpose, and format version using authenticated additional data.
- Review database backups, exports, support tooling, and retention paths.

**Residual risk:** Metadata such as row count, timestamps, access patterns, and ciphertext size may remain visible. Endpoint/device compromise is not mitigated by encryption at rest.

### T2 — Malicious or compromised application server

**Threat:** A compromised server serves modified JavaScript that captures secrets or key material when the user unlocks the Vault.

**Target controls:**
- Treat application delivery and deployment credentials as part of the cryptographic trusted computing base.
- Enforce strong deployment access control, protected branches, reviewed changes, dependency pinning/lockfile integrity, and release provenance.
- Use a restrictive Content Security Policy and avoid unsafe script execution patterns; review third-party scripts and dependencies.
- Consider independent code review and reproducible build/release evidence.
- Document honestly that ordinary web-delivered client-side encryption cannot protect against a server that can replace the client code.

**Residual risk:** A server capable of serving malicious client code may capture secrets during unlock. A zero-knowledge data format alone does not eliminate this risk.

### T3 — Cross-site scripting (XSS) or malicious dependency

**Threat:** Script execution in the Vault origin reads plaintext fields or invokes cryptographic operations while unlocked.

**Target controls:**
- Strict output encoding and safe rendering; avoid unsafe HTML injection.
- Restrictive CSP with nonces/hashes where compatible; minimize third-party JavaScript.
- Dependency review, lockfile integrity, automated vulnerability checks, and update policy.
- Keep secrets out of DOM attributes, URLs, analytics, error telemetry, and console output.
- Security tests for stored/reflected/DOM XSS and dependency compromise.

**Residual risk:** Same-origin script execution can generally act with the user's current page privileges. No browser-memory design can promise protection from active XSS.

### T4 — Browser extension or compromised device

**Threat:** A privileged extension, malware, remote-control software, or another local process observes unlocked data or clipboard contents.

**Target controls:**
- Minimize how long plaintext is held and show secrets only on explicit user action.
- Offer manual lock and configurable inactivity locking after usability and threat review.
- Never claim the application can securely erase all JavaScript/browser/OS memory.
- Warn users about trusted devices and clipboard exposure.

**Residual risk:** A compromised endpoint can observe displayed or copied secrets. This threat cannot be solved by server-side or client-side encryption alone.

### T5 — Session theft, CSRF, and unauthorized API access

**Threat:** An attacker reuses a stolen session or causes an authenticated browser to perform an unwanted mutation.

**Target controls:**
- Continue server-side session validation on every protected API request.
- Enforce ownership predicates on every read, update, and delete; never trust a client-supplied user ID.
- Require same-origin validation and appropriate content type for state-changing requests.
- Review cookie flags, session rotation, expiry, revocation, and reauthentication requirements.
- Add negative tests for unauthenticated requests, expired sessions, cross-user IDs, CSRF attempts, and replayed mutations.

**Residual risk:** A valid stolen session may still authorize actions until revoked or expired. Client-side encryption reduces server knowledge but does not replace API authorization.

### T6 — Ciphertext substitution, tampering, or replay

**Threat:** An attacker swaps ciphertext between records/Vaults, modifies an envelope, or replays an older valid value.

**Target controls:**
- Use authenticated encryption (AES-256-GCM only after implementation review and test-vector verification).
- Bind AAD to stable Vault ID, record ID, field purpose, and format version.
- Enforce strict IV generation/uniqueness requirements for each key; never reuse a GCM IV with the same key.
- Validate envelope version, algorithm, IV length, ciphertext/tag length, and encoding.
- Add tamper, wrong-key, wrong-AAD, wrong-record, wrong-Vault, malformed-input, and replay/version tests.
- Define monotonic record versioning or another concurrency strategy if rollback/replay detection is required.

**Residual risk:** Authenticated encryption detects unauthorized modification but does not alone prove freshness or prevent rollback to an older valid ciphertext.

### T7 — Weak password, KDF abuse, and offline guessing

**Threat:** A stolen key envelope enables offline password guessing, or an attacker abuses unlock endpoints for resource exhaustion.

**Target controls:**
- Select and document Argon2id parameters based on measured supported-device performance and current security guidance.
- Use test vectors and input normalization rules; version KDF parameters in the envelope format.
- Ensure derived bytes are handled narrowly and cleared where practical; acknowledge that garbage collection and browser internals prevent guaranteed erasure.
- Apply rate limits and abuse monitoring to online authentication without logging secrets.
- Avoid exposing detailed unlock errors that create an oracle.

**Residual risk:** A weak user secret remains vulnerable to offline guessing if an attacker obtains the wrapped-key material. KDF settings cannot compensate for a low-entropy secret completely.

### T8 — Recovery, device loss, and account takeover

**Threat:** A user loses the only decryption secret, or an attacker abuses recovery to obtain plaintext access.

**Target controls:**
- Decide explicitly whether recovery is user-held recovery material, trusted-device transfer, or another reviewed mechanism.
- Do not create a server-side master decryption key or silent plaintext recovery bypass while claiming zero-knowledge.
- Document the consequences of losing all recovery material.
- Threat-model recovery phishing, support impersonation, recovery-code theft, and device replacement.
- Test recovery in an isolated environment before migrating real records.

**Open decision:** Recovery UX, threat trade-offs, and user responsibility must be approved before implementation.

### T9 — Legacy migration failure

**Threat:** A partial or interrupted conversion leaves mixed formats, inaccessible records, or duplicate legacy plaintext/decryptable copies.

**Target controls:**
- Use explicit per-record format versions and migration states.
- Encrypt locally, write the new envelope, then verify local decryption before marking migration complete.
- Make operations idempotent and safe to retry.
- Define backup, rollback, concurrent-edit, duplicate-submit, and partial-failure behavior.
- Test empty, large, malformed, interrupted, and partially migrated Vaults.
- Never drop legacy compatibility or run a schema migration before owner approval and a tested recovery plan.

### T10 — Logs, analytics, public dashboard, and research disclosure

**Threat:** Secret-bearing values or private identifiers leak through observability, error reporting, screenshots, or public research.

**Target controls:**
- Use allowlisted event fields; never log request bodies, plaintext, keys, ciphertext payloads, auth tokens, or raw exceptions.
- Redact identifiers and avoid secret-bearing URLs/query strings.
- Keep public dashboard read-only and fed only by approved, sanitized evidence.
- Require technical review, sensitive-data/security review, and owner approval before publication.
- Use real authorized test telemetry only; no fabricated attack activity.

## 4. Risk register

| Threat | Impact | Priority before zero-knowledge release | Required evidence |
|---|---|---|---|
| Database/backup disclosure | Credential exposure under current server-decrypt model | Critical | Client-only encryption design, key separation, backup review |
| Malicious client delivery/XSS | Secrets exposed while unlocked | Critical | CSP review, XSS tests, deployment controls, independent review |
| Cross-user API access | Unauthorized record disclosure/modification | Critical | Ownership and negative authorization tests |
| Key loss/recovery bypass | Permanent data loss or confidentiality failure | Critical | Approved recovery model and recovery tests |
| Ciphertext/IV/AAD misuse | Decryption failure or cryptographic compromise | Critical | Test vectors, uniqueness analysis, tamper and substitution tests |
| Legacy migration failure | Data loss or retained legacy exposure | High | Migration rehearsal, rollback and reconciliation evidence |
| Clipboard/device compromise | Local secret disclosure | High | UX warning, endpoint threat disclosure, minimized exposure |
| Public/log disclosure | Private data leakage | High | Redaction tests and publication review |

Priority is a design-review classification, not a measured exploitability score.

## 5. Security invariants

These must remain true in any approved implementation:

- The server never receives the plaintext DEK, KEK, or user recovery secret.
- The server never decrypts account record content in the target zero-knowledge architecture.
- Every record operation is authorized against the authenticated Vault owner.
- Every ciphertext is authenticated and bound to its intended Vault, record, purpose, and format.
- No AES-GCM key/IV pair is reused.
- No secret is stored in browser persistent storage or emitted to telemetry.
- Public surfaces never display live secrets, private identifiers, or unsanitized test data.
- No release claim exceeds the scope of executed tests and independent review.
- Locking clears application references and conceals the UI, but is not described as guaranteed physical memory erasure.

## 6. Verification gates

### Gate A — Design approval
- [ ] Owner approves threat model and security objectives.
- [ ] Key hierarchy, KDF parameters, metadata model, recovery, and migration decisions are documented.
- [ ] Threat model reviewed by an independent security reviewer.

### Gate B — Isolated implementation
- [ ] Client-side cryptography integrated without sending keys to the server.
- [ ] Collection endpoint returns metadata ciphertext only.
- [ ] Detail endpoint returns one record's encrypted payload only.
- [ ] Mutations accept ciphertext envelopes only.
- [ ] Existing data migration tested using disposable fixtures.

### Gate C — Security verification
- [ ] Cryptographic test vectors and tamper/substitution tests pass.
- [ ] Authorization, cross-Vault, CSRF, session, and replay tests pass.
- [ ] XSS/CSP/dependency review completed.
- [ ] Logs, analytics, cache headers, and browser persistence reviewed.
- [ ] Recovery, lock, logout, and session-expiry tests pass.
- [ ] Independent review findings resolved or explicitly accepted.

### Gate D — Release authorization
- [ ] Migration backup and rollback strategy approved.
- [ ] Production deployment and migration separately authorized.
- [ ] User-facing limitations and recovery consequences documented.
- [ ] Public claims accurately reflect verified behavior.

## 7. Explicit exclusions and current status

This threat model does not authorize:
- API or database changes.
- Authentication or session changes.
- Production secret changes.
- Production database migrations.
- Production deployment or merge to `main`.
- Testing against third-party accounts or systems.

The existing Vault remains server-mediated encrypted storage. The client key-envelope helper is a building block only; it is not evidence that the Vault is currently zero-knowledge. This document is a draft design artifact, not an audit, penetration test, certification, or guarantee that the system cannot be compromised.
