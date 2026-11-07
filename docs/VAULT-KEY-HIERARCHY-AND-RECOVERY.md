# Vault Key Hierarchy and Recovery Architecture

**Status: DESIGN PROPOSAL ONLY — NOT APPROVED FOR IMPLEMENTATION**  
**Date:** 2026-11-08  
**Scope:** Private Gmail Vault key management, recovery, and multi-device access.

This document proposes a reviewable key hierarchy. It does not describe the current production behavior and does not authorize code changes, database migrations, authentication changes, or deployment.

## 1. Design goals and non-goals

### Goals
- Separate account authentication from authority to decrypt Vault data.
- Keep Vault encryption and decryption keys under user-device control.
- Support recovery without creating a silent server-side decryption backdoor.
- Allow an ordinary Vault unlock-secret change without re-encrypting every record.
- Make key formats versioned, authenticated, and migratable.
- State clearly when data is unrecoverable.

### Non-goals
- Promise protection against a compromised device, malicious browser extension, XSS, or malicious application code delivered by the server.
- Claim that browser memory can be reliably zeroized.
- Provide administrator, support-agent, or server-side master-key recovery.
- Implement social/guardian recovery in the first release.

## 2. Separate authentication from Vault decryption

Two independent capabilities are required:

1. **Authentication session:** Supabase Auth proves that the user controls the account and may access that user's encrypted Vault records.
2. **Vault unlock capability:** A locally derived wrapping key unwraps the Vault Data Encryption Key (DEK). Without the unlock secret or a valid recovery method, an authenticated session alone must not decrypt record contents.

A Supabase password reset restores account authentication only. It must not silently reset the Vault unlock secret, unwrap the DEK, or decrypt existing records.

## 3. Proposed key hierarchy

### 3.1 Vault Data Encryption Key

- Generate a cryptographically random 256-bit DEK on the user's device when the Vault is initialized.
- The DEK is never sent to the application server in plaintext.
- Use a reviewed key-derivation design to derive purpose-separated encryption keys from the DEK with HKDF-SHA-256 and explicit, distinct context labels (for example, record payloads and protected metadata).
- Do not reuse an AES-GCM key across unrelated purposes.
- Each encrypted object uses a fresh 96-bit nonce/IV for AES-GCM. Enforce nonce uniqueness per key; define collision handling and format validation in the implementation review.
- Authenticated Additional Data (AAD) binds ciphertext to its context: Vault ID, record ID where applicable, field/purpose label, and schema/format version. This prevents valid ciphertext from being silently moved between records or purposes.
- The exact envelope format, HKDF labels, nonce generation, and key lifecycle must be reviewed against the existing crypto modules before implementation.

### 3.2 Unlock-secret wrapping key

- The user chooses a dedicated Vault unlock secret, separate from their Supabase password.
- Derive a Key Encryption Key (KEK) locally with Argon2id using a unique random salt and versioned, reviewed parameters.
- The KEK wraps the random DEK in an authenticated AES-GCM envelope.
- Store only the salt, KDF identifier/version/parameters, nonce, and wrapped-DEK ciphertext on the server.
- Never store or transmit the unlock secret or plaintext KEK.
- Do not select final Argon2id memory/time/parallelism parameters by guesswork. Benchmark supported mobile and desktop devices, set a documented minimum, and review denial-of-service and compatibility implications.

Changing the Vault unlock secret should derive a new KEK and re-wrap the same DEK. It should not require re-encrypting every record, provided the DEK and envelope format remain valid.

### 3.3 Recovery-key wrapping

The recommended first-release recovery model is a user-held, randomly generated recovery key:

- Generate an independent random 256-bit recovery secret on the user's device.
- Derive a recovery wrapping key with a reviewed HKDF-SHA-256 construction and a distinct context label.
- Use it to create a second authenticated envelope around the same DEK.
- The server may store this recovery envelope, but it must never receive the plaintext recovery secret or the unwrapped DEK.
- Present the recovery secret once in a carefully designed save-and-confirm flow. Offer a downloadable recovery file and a human-readable representation only if encoding, checksum, and transcription safety are independently reviewed.
- Require the user to confirm possession before treating recovery setup as complete.
- Do not put the recovery secret in URLs, logs, analytics, crash reports, clipboard automatically, or browser persistent storage.

The recovery envelope is not itself a recovery secret. Possession of the user-held secret is required to unwrap it.

## 4. Recovery policy and user consequences

| Situation | Expected behavior |
|---|---|
| User forgets Supabase password but still knows Vault unlock secret | Complete Supabase account recovery, then unlock Vault normally. |
| User changes Supabase password | Vault keys and encrypted records remain unchanged. |
| User changes Vault unlock secret while Vault is unlocked | Derive a new KEK and replace the unlock envelope after verifying the new envelope. |
| User forgets Vault unlock secret but has recovery key | Authenticate, retrieve the recovery envelope, unwrap the DEK locally, then establish a new unlock-secret envelope. |
| User loses unlock secret and recovery key, with no separately approved trusted device | Existing encrypted Vault data is unrecoverable. Support cannot bypass this. |
| Recovery key may be compromised | While the Vault is unlocked, create and verify a new recovery envelope, then invalidate the old one. Consider DEK rotation if exposure may include the DEK itself. |
| User loses access to the account but has recovery key | Account ownership must still be recovered through a separate, secure authentication process. A recovery key alone must not bypass account authorization. |

**Critical user-facing disclosure:** If both the Vault unlock secret and every recovery method are lost, the data cannot be restored. This is an intentional consequence of not having a server-side decryption backdoor.

## 5. Recovery workflow

### Setup
1. User authenticates and initializes the Vault on a trusted device.
2. Device generates the DEK and the unlock-secret envelope locally.
3. Device generates a separate recovery secret and recovery envelope locally.
4. Server receives only versioned salts/parameters and encrypted envelopes.
5. UI displays the recovery secret with a clear warning and a save/export action.
6. User confirms they have saved it; the application verifies the recovery material by testing a local unwrap operation before setup is marked complete.

### Forgotten unlock secret
1. User completes normal account authentication.
2. User enters the saved recovery secret locally.
3. Device retrieves the encrypted recovery envelope and unwraps the DEK locally.
4. User creates a new Vault unlock secret.
5. Device derives a new KEK, creates a new unlock envelope, and verifies it by unwrapping.
6. Only after verification does the server-side envelope update replace the old unlock envelope.
7. The recovery envelope remains valid unless the user explicitly rotates the recovery key.

### Recovery-key rotation
1. Require an already unlocked Vault.
2. Generate a new independent recovery secret and envelope locally.
3. Verify the new envelope locally.
4. Persist the new envelope successfully.
5. Invalidate the previous recovery envelope only after the new one is confirmed stored.
6. Show the new recovery secret and require the user to save and confirm it.

All transitions must be atomic or safely retryable. A failed network request must not leave the user believing that a new recovery key is active when the server still holds only the old envelope.

## 6. Multi-device policy

**MVP recommendation:** Each new device authenticates normally and requires either the Vault unlock secret or the recovery key to unwrap the DEK locally. Do not silently synchronize plaintext keys through a server.

A future trusted-device feature may wrap the DEK for a device-specific public key, but only after a separate design review covering:
- Device key generation and protected storage.
- Device enrollment and user-visible verification.
- Lost-device revocation and its limits.
- Cross-device transfer authentication.
- Backup and restore behavior.
- Malware, browser-profile, and device-compromise assumptions.

A device marked trusted must not become an invisible recovery backdoor.

## 7. Storage boundaries

| Location | Permitted data | Prohibited data |
|---|---|---|
| Server/database | Ciphertext, wrapped-DEK envelopes, salts, KDF parameters, format versions, minimal operational metadata | Plaintext passwords, backup codes, unlock secret, recovery secret, plaintext DEK/KEK |
| Browser memory while unlocked | Short-lived CryptoKey references and the minimum plaintext required for the active interaction | Unnecessary long-lived plaintext copies, secret-bearing logs or telemetry |
| Browser persistent storage | Non-secret preferences and carefully reviewed public metadata only | Plaintext secrets, raw unlock/recovery secrets, plaintext DEK/KEK |
| Recovery export controlled by user | Recovery secret and non-secret instructions | Supabase password, account passwords, unrelated secrets |

A non-extractable Web Crypto key reduces direct key export but does not protect against malicious same-origin script using the key while the Vault is unlocked. XSS, compromised dependencies, malicious server-delivered JavaScript, browser extensions, and device compromise remain relevant threats.

The application must not claim reliable memory zeroization. Lock/sign-out should drop application references, clear rendered secret state, abort pending sensitive operations where possible, and return the UI to a concealed state; these measures reduce exposure but cannot guarantee physical erasure from browser or operating-system memory.

## 8. Cryptographic format and lifecycle requirements

Every envelope and ciphertext format must include explicit, validated version metadata. The implementation specification must define:
- Algorithm identifiers and key sizes.
- KDF identifier, salt length, and parameter version.
- HKDF context labels and key-purpose separation.
- AES-GCM nonce length, uniqueness strategy, and authentication-tag handling.
- AAD construction and canonical encoding.
- Vault/record/field binding and schema versioning.
- Strict parsing, size limits, and rejection of unknown or downgraded formats.
- Key rotation, envelope replacement, and interrupted-operation recovery.
- No secret-bearing logs, URLs, analytics, error messages, or cache entries.

Authenticated encryption detects modification but does not, by itself, prevent an attacker from restoring an older valid ciphertext. Rollback/replay protection needs a separately reviewed monotonic version or integrity strategy and a clearly defined trust anchor.

## 9. Implementation and verification gates

### Gate A — Cryptographic design review
- [ ] Review the existing Argon2id and key-envelope modules.
- [ ] Independently review the exact HKDF and AES-GCM constructions.
- [ ] Confirm nonce uniqueness strategy and AAD canonicalization.
- [ ] Review parameter choices and mobile performance.
- [ ] Threat-model malicious application delivery and XSS.

### Gate B — Recovery correctness
- [ ] Recovery setup and possession confirmation.
- [ ] Forgotten unlock-secret recovery.
- [ ] Recovery-key rotation and old-envelope invalidation.
- [ ] Lost recovery material behavior and accurate user disclosure.
- [ ] Interrupted requests, retries, duplicate submissions, and concurrent changes.
- [ ] Authentication reset never decrypts or resets Vault keys.

### Gate C — Data and compatibility
- [ ] Server never receives plaintext DEK, KEK, unlock secret, or recovery secret.
- [ ] Collection and detail APIs return ciphertext only for protected content.
- [ ] Legacy server-encrypted records have a separately approved migration plan.
- [ ] Migration is rehearsed, idempotent, backed up, and rollback-tested.
- [ ] Old and new format handling is explicit; no silent downgrade.

### Gate D — Independent verification and release
- [ ] Unit, integration, property, and negative cryptographic tests.
- [ ] Cross-browser and mobile-device verification.
- [ ] XSS/dependency/session threat review.
- [ ] Independent security review findings resolved or explicitly accepted.
- [ ] User-facing recovery limitations and release claims reviewed.
- [ ] Production changes separately authorized.

## 10. Decisions recommended for the MVP

1. Use one random 256-bit DEK per Vault, wrapped independently by a locally derived unlock KEK and a user-held recovery key.
2. Use HKDF-derived purpose-specific subkeys rather than reusing one AES-GCM key for every data purpose.
3. Keep Supabase authentication and Vault unlocking separate.
4. Make the recovery key user-held; do not implement server-assisted plaintext recovery.
5. Do not add trusted-device or social recovery in the MVP.
6. Treat losing both unlock and recovery material as permanent data loss.
7. Require independent cryptographic review before implementation.

These are recommendations for owner review, not approved implementation decisions.

## 11. Approval boundary and current state

This proposal does not authorize:
- Changes to authentication, session handling, APIs, or database schema.
- Crypto module integration or replacement.
- Legacy data migration.
- Production secrets or environment changes.
- Merge to `main`, preview builds, or production deployment.

The existing Vault remains server-mediated encrypted storage and is not currently zero-knowledge. Existing client-side crypto helpers are building blocks only. No feature described here should be presented as implemented or verified until the relevant code exists and passes the verification gates.
