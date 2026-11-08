# Vault Recovery, Key Rotation, and Legacy Migration — Failure Test Plan

**Status: TEST PLAN PROPOSAL ONLY — NOT APPROVED FOR IMPLEMENTATION**  
**Date:** 2026-11-08  
**Related designs:** `VAULT-THREAT-MODEL.md`, `VAULT-KEY-HIERARCHY-AND-RECOVERY.md`

This document turns the proposed key hierarchy into failure-oriented acceptance tests. It is not evidence that any test has run. It does not authorize crypto integration, API/database changes, legacy migration, production changes, merge, preview, or deployment.

## 1. Test principles

- Test only isolated, synthetic Vault accounts and fictional credentials.
- Never use real Gmail passwords, backup codes, or production customer data in test fixtures.
- Test both expected success and deliberate failure; cryptographic code must fail closed.
- Treat network interruption, duplicated requests, stale tabs, concurrent devices, and browser refresh as normal failure conditions.
- Verify server-side storage and logs do not contain plaintext secrets or raw keys.
- Keep authentication authorization separate from the ability to decrypt.
- Record exact software/browser versions, test inputs as non-secret identifiers, outcomes, and reproducible steps. Never record secret values.
- A passing unit test is not an independent cryptographic review, browser security audit, or production-readiness sign-off.

## 2. Key lifecycle state model

The implementation should use explicit, persisted states rather than infer completion from UI messages.

| State | Meaning | Allowed next transitions |
|---|---|---|
| `UNINITIALIZED` | No Vault key hierarchy exists | Initialize |
| `INITIALIZING` | Keys/envelopes being created and persisted | `ACTIVE` or safe retry |
| `ACTIVE` | Unlock envelope and required recovery envelope verified | Unlock, rotate unlock secret, rotate recovery key, lock |
| `UNLOCKED` | DEK available to current application context | Read/write, rotate, lock, sign out |
| `ROTATING_UNLOCK` | New unlock envelope being prepared | `ACTIVE` after verification, or retain old envelope on failure |
| `ROTATING_RECOVERY` | New recovery envelope being prepared | `ACTIVE` after verification, or retain old envelope on failure |
| `MIGRATING` | One or more legacy records are being converted | Per-record verified progress, pause, retry, or approved rollback |
| `RECOVERY_REQUIRED` | Normal unlock unavailable; recovery path required | Recover or remain locked |
| `LOCKED` | No active UI access to decrypted records | Unlock or recovery |
| `ERROR_SAFE` | Integrity, version, or persistence failure | Remain locked; explicit recovery/support guidance |

State names are conceptual. Exact persistence and concurrency semantics must be designed and reviewed before implementation. Never mark a transition complete solely because a client-side operation appeared to succeed; verify the persisted envelope/version.

## 3. Unlock-secret and envelope rotation tests

| ID | Scenario | Expected safe result |
|---|---|---|
| ROT-01 | Correct current unlock secret | KEK derives and unwraps the expected DEK; Vault unlocks. |
| ROT-02 | Incorrect unlock secret | Authentication tag verification fails; remain locked; no plaintext fallback. |
| ROT-03 | New unlock secret accepted; new envelope stored and read back | New envelope unwraps to the same DEK; rotation completes. |
| ROT-04 | New envelope write fails before persistence | Old envelope remains valid; UI reports rotation incomplete. |
| ROT-05 | Network drops after server may have committed | Re-read envelope version and verify; do not blindly overwrite or claim failure/success without reconciliation. |
| ROT-06 | Duplicate rotation request | Idempotent or conflict-safe behavior; never produce ambiguous active envelopes. |
| ROT-07 | Two tabs rotate concurrently | Version/compare-and-swap conflict detected; one operation wins; stale tab must reload and re-verify. |
| ROT-08 | Rotation interrupted by refresh or tab close | On next visit, server state determines active envelope; no partial success claim. |
| ROT-09 | Old envelope replayed after successful rotation | Version/rollback policy rejects stale envelope where the chosen trust model supports this; document residual server rollback risk. |
| ROT-10 | KDF parameter version unknown or unsupported | Fail closed with upgrade guidance; never silently downgrade to weaker parameters. |
| ROT-11 | KDF salt or envelope metadata malformed | Reject before decryption; bounded parsing and no crash/leak. |
| ROT-12 | AAD Vault ID mismatch | Unwrap fails; no cross-Vault key substitution. |
| ROT-13 | Authentication session expires during rotation | Abort or safely finish only according to a reviewed transaction model; no unauthenticated persistence. |
| ROT-14 | User signs out during rotation | Clear UI key references as far as practical; reconcile persisted state on next sign-in. |

**Invariant:** Changing the unlock secret re-wraps the DEK; it does not silently generate a new DEK or re-encrypt record data. Any DEK rotation is a separate, explicitly designed operation.

## 4. Recovery setup and recovery-key rotation tests

| ID | Scenario | Expected safe result |
|---|---|---|
| REC-01 | Generate recovery secret and envelope | Secret generated with a cryptographically secure random source; server receives only envelope and non-secret metadata. |
| REC-02 | User confirms recovery possession | Local unwrap test succeeds before recovery is marked configured. |
| REC-03 | User dismisses or fails save confirmation | Recovery setup remains incomplete; clear warning; do not claim recoverability. |
| REC-04 | Correct recovery secret | Local unwrap recovers the DEK; user can establish a new unlock envelope. |
| REC-05 | Incorrect recovery secret | Authentication fails; remain locked; rate-limit expensive attempts without disclosing secret validity to unauthorized parties. |
| REC-06 | Recovery envelope tampered | Authentication fails; no fallback to plaintext or old unverified state. |
| REC-07 | Recovery envelope belongs to another Vault | AAD binding rejects it. |
| REC-08 | New recovery envelope write fails | Previous recovery envelope remains usable; new secret is not presented as active. |
| REC-09 | New recovery envelope stored, then client loses response | Read back envelope/version and verify before invalidating old envelope. |
| REC-10 | Old recovery envelope invalidated after new one verified | Old recovery material no longer works under the selected version policy. |
| REC-11 | User loses unlock secret and recovery secret | Vault remains unrecoverable; support/admin cannot bypass cryptography. |
| REC-12 | User resets Supabase password | Authentication is restored through its own flow; Vault DEK remains wrapped and unavailable without unlock/recovery material. |
| REC-13 | Account session revoked during recovery | No further protected envelope access or mutation; user must re-authenticate. |
| REC-14 | Recovery secret accidentally appears in logs, URL, analytics, or error | Test fails; block release and investigate exposure. |
| REC-15 | Recovery file downloaded, re-imported on a second device | Exact format/version validated; successful local unwrap; malformed files rejected safely. |

Recovery-key rotation must not invalidate the old recovery envelope until the new one is persisted and successfully verified. If a compromise may include the DEK itself, merely rotating the recovery envelope is insufficient; assess and separately plan DEK rotation.

## 5. Legacy data migration plan and failure tests

### 5.1 Current-to-target boundary

The current Vault is server-mediated: the existing server decrypts legacy records and returns plaintext fields to the authenticated browser. The target design proposes client-side encryption with server-stored ciphertext only.

A migration must therefore be treated as a security-sensitive transition, not a routine schema conversion. A server-side job that decrypts legacy rows and encrypts them with a server-held key does **not** achieve the proposed zero-knowledge target.

A possible staged path for owner review is:
1. Create a synthetic test Vault and verify export/import formats.
2. Authenticate through the existing flow and retrieve legacy records through the existing authorized path.
3. On the user's trusted browser, encrypt each record under the new client-held key hierarchy.
4. Upload new ciphertext and verify by reading it back and decrypting locally.
5. Mark each record migrated only after ciphertext read-back and integrity verification.
6. Keep legacy data recoverable during the approved transition window; do not delete it before verified backup, owner approval, and rollback rehearsal.
7. Once all records are verified and the cutover is approved, disable legacy plaintext-returning paths and remove legacy server decryption capability according to a separately reviewed plan.

This staged path still exposes legacy plaintext to the authenticated browser and existing server-side decryption path during migration. It is not zero-knowledge until legacy paths are retired and the target architecture is independently verified.

### 5.2 Migration failure matrix

| ID | Scenario | Expected safe result |
|---|---|---|
| MIG-01 | Empty legacy Vault | Migration completes without creating phantom records. |
| MIG-02 | Single valid legacy record | New ciphertext read-back decrypts to the expected synthetic fixture. |
| MIG-03 | Large record / long backup-code list | Enforced size limits; no truncation; integrity verified. |
| MIG-04 | Malformed legacy row | Quarantine/report by non-secret record identifier; do not silently skip or corrupt. |
| MIG-05 | Duplicate migration submission | Idempotent result; one authoritative migrated version. |
| MIG-06 | Network interruption before upload | Record remains legacy; retry safe. |
| MIG-07 | Network interruption after upload but before response | Read back by stable migration ID/version; reconcile before retry. |
| MIG-08 | Ciphertext stored but read-back differs | Do not mark migrated; keep legacy copy; fail closed. |
| MIG-09 | Local decryption/read-back fails | Do not delete legacy copy; report integrity failure without secret data. |
| MIG-10 | Browser closes mid-batch | Resume from verified per-record checkpoints; no false completion percentage. |
| MIG-11 | Two devices migrate same record | Concurrency/version conflict detected; no last-write-wins secret loss. |
| MIG-12 | DEK unavailable or recovery incomplete | Pause migration; do not request or store a server-side master key. |
| MIG-13 | Unsupported target format version | Stop before writing; require compatible client upgrade. |
| MIG-14 | Legacy and new record counts disagree | Block cutover; produce a metadata-only reconciliation report. |
| MIG-15 | Backup restore rehearsal | Restored data decrypts under the expected user-held keys; no secret is logged. |
| MIG-16 | Rollback after partial migration | Revert only through the reviewed per-record state model; never silently downgrade to weaker encryption. |
| MIG-17 | Legacy endpoint remains accessible after cutover | Release gate fails; disable and verify all plaintext-returning legacy routes. |
| MIG-18 | Logs/telemetry inspect migration payloads | No usernames, passwords, backup codes, keys, or plaintext payloads appear. |

### 5.3 Migration release gates

- [ ] Inventory every legacy storage format and decrypting code path.
- [ ] Define stable record IDs and versioned migration checkpoints.
- [ ] Define backup retention, access control, and deletion approval.
- [ ] Rehearse interrupted batches and duplicate submissions.
- [ ] Verify every migrated record by ciphertext read-back and local decryption.
- [ ] Reconcile record counts and non-secret metadata.
- [ ] Verify legacy plaintext API routes are disabled after cutover.
- [ ] Independently review rollback and backup restoration.
- [ ] Obtain explicit owner approval before any real-data migration.

## 6. Cross-cutting security and regression tests

### Cryptographic negative tests
- [ ] Flip each ciphertext byte and confirm authentication failure.
- [ ] Modify nonce, tag, AAD, Vault ID, record ID, field-purpose label, and schema version independently.
- [ ] Swap ciphertext between two records and two Vaults; reject both.
- [ ] Reject truncated, oversized, malformed, and unknown-version envelopes.
- [ ] Verify nonce uniqueness strategy under high-volume synthetic generation.
- [ ] Test key-purpose separation: a key derived for one purpose cannot decrypt another purpose.
- [ ] Verify unsupported/downgraded KDF settings are rejected.

### Application and privacy tests
- [ ] No plaintext secrets in server responses except explicitly identified legacy transition paths before retirement.
- [ ] No secrets in logs, traces, analytics, URLs, browser console, error boundaries, or public dashboard.
- [ ] Lock, sign-out, account switch, session expiry, and tab close conceal rendered secrets and clear application references where possible.
- [ ] Clipboard behavior is explicit; do not claim the application can erase OS clipboard contents.
- [ ] API authorization is checked independently for collection, detail, mutation, and envelope endpoints.
- [ ] CSRF/session controls and rate limits are tested for all sensitive operations.
- [ ] XSS/dependency compromise assumptions are documented; no claim that non-extractable keys defeat same-origin malicious script.

### UX and accessibility tests
- [ ] Recovery consequences are understandable before setup.
- [ ] User can verify the recovery secret is saved without exposing it in logs or telemetry.
- [ ] Error messages do not reveal secret values or cryptographic internals.
- [ ] Keyboard-only and screen-reader recovery journeys are tested.
- [ ] Mobile download/export/import flows are tested on supported browsers.
- [ ] Reduced-motion and interrupted-flow behavior remains accessible.

## 7. Evidence record template

For each executed test, record:
- Test ID and test-plan version.
- Commit SHA and application build identifier.
- Browser, OS, and device class.
- Synthetic fixture identifier (never secret values).
- Preconditions and safe reproduction steps.
- Expected result and actual result.
- Pass/fail/blocked status.
- Sanitized logs and evidence reference.
- Defect link, severity, remediation commit, and retest result.
- Reviewer and review date.

A test must be marked **NOT RUN** until evidence exists. A source-code inspection is not a runtime test. A CI pass is evidence only for the checks that CI actually executed.

## 8. Release decision checklist

Do not authorize real-data migration or release until:
- [ ] Key hierarchy and exact cryptographic constructions receive independent review.
- [ ] Recovery and rotation failure matrices pass on supported browsers/devices.
- [ ] Migration is rehearsed with synthetic data and restore/rollback is demonstrated.
- [ ] Legacy plaintext-returning paths are retired and verified.
- [ ] No critical/high unresolved security findings remain, or the owner explicitly accepts documented residual risk.
- [ ] User-facing irrecoverability and recovery behavior are approved.
- [ ] Production migration, deployment, and secret changes receive separate explicit authorization.

## 9. Explicit approval boundary

This plan does not authorize:
- Changes to API routes, authentication, session behavior, crypto modules, or database schema.
- Any migration of real Vault records.
- Deletion or transformation of existing data.
- Changes to production secrets or environment configuration.
- Merge to `main`, preview builds, or production deployment.

Current Vault behavior remains server-mediated encrypted storage and is not zero-knowledge. All tests in this document are proposed and **NOT RUN** unless a future evidence record explicitly proves otherwise.
