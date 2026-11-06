# Client-Side Encryption Migration Plan

**Status:** Approved engineering direction; implementation not yet complete  
**Branch:** `feature/vault-authentication`  
**Production impact:** None. This document does not authorize production secrets, database changes, merges, or deployments.

## 1. Why the current Preview fails

The current API encrypts and decrypts account records on the server. It requires both a privileged Supabase server credential and `VAULT_DATA_ENCRYPTION_KEY`. The current Preview configuration does not have those values correctly configured, so the Vault API returns generic save/open errors.

Adding those server keys would only restore the old server-readable design. It would not meet the project's stronger security objective, so this migration deliberately does not use that as the final fix.

## 2. Verified current security boundary

At the current branch revision:

- The browser sends the account fields (including password and backup codes) as JSON to `/api/vault/items`.
- The API calls `encryptVaultItem()` on the server.
- The server holds `VAULT_DATA_ENCRYPTION_KEY` and decrypts records before returning them to the browser.
- Therefore the server can access plaintext credentials during normal save and read operations.
- The current Vault Master Password is also used as the Supabase Auth password in the login flow. It is not currently a client-only encryption secret.
- Recovery Code material is currently processed by server-side recovery-encryption code.

This is server-side encryption at rest, not zero-knowledge encryption. Do not store real high-value credentials in this implementation.

## 3. Target trust boundary

The target data path is:

1. Supabase Auth authenticates the user and establishes a session.
2. The browser independently unlocks the vault using a client-only Master Password or an independently reviewed recovery flow.
3. The browser derives a Key Encryption Key (KEK) using a vetted Argon2id implementation and a per-vault random salt.
4. A random 256-bit Data Encryption Key (DEK) is generated client-side. The KEK wraps/unwraps the DEK.
5. The browser encrypts and decrypts complete account records using Web Crypto AES-256-GCM.
6. The API and database receive and return ciphertext plus public protocol metadata only.

The API must never receive the Master Password, plaintext account fields, KEK, or unwrapped DEK. The service-role credential remains server-only and must never be sent to the browser.

## 4. Authentication must be separate from encryption

The current implementation reuses the Vault Master Password as the Supabase Auth password. That must change before the Master Password can be described as client-only.

The implementation must choose and test a separate authentication factor (preferably WebAuthn/passkey where the chosen Supabase integration supports the required server-side verification; otherwise a separate authentication credential). The client-only Master Password is used only to unlock encryption keys. Do not silently reuse one password for both purposes.

This creates two distinct security responsibilities:
- Authentication answers: "May this session access this user's encrypted records?"
- Vault unlock answers: "Can this client decrypt the records?"

A successful login must not by itself decrypt the vault. A successful vault unlock must not create or elevate a server session.


## 4A. Authentication transition decision

The repository currently uses the Vault Master Password as the Supabase Auth password. This must not remain the final design.

Supabase's current JavaScript Passkey API is documented as **experimental** and requires `@supabase/supabase-js` v2.105.0 or later. The repository currently pins the 2.57.x line. Passkey registration also requires an existing signed-in, confirmed, non-anonymous user. The Supabase project must explicitly enable passkeys and configure a stable WebAuthn RP ID and allowed origins. Changing the RP ID later invalidates previously registered passkeys.

Implementation decision:
- Evaluate Supabase Passkeys as the preferred phishing-resistant server-authentication mechanism, but do not enable it or upgrade the production project as part of this branch-only change.
- First build a compatibility spike on the feature branch using an isolated test project or mocked Auth boundary. Confirm the exact installed SDK API, browser support, and mobile UX.
- Keep authentication and vault unlocking separate: a passkey session must not automatically unwrap the DEK; the client-only Master Password-derived KEK remains a separate unlock step.
- Design account bootstrap and lost-passkey recovery before removing the current password login. Do not silently fall back to sending the Master Password to Supabase.
- Keep the existing authentication path explicitly marked legacy until the replacement passes account creation, sign-in, session refresh, passkey enrollment, multi-device, revocation, and recovery tests.

If experimental Supabase Passkeys are not acceptable for a production release, select a separately maintained WebAuthn server integration or a different supported authentication factor. Do not write custom WebAuthn signature verification.

## 5. Recovery protocol requirements

The current server-encrypted pending Recovery Code flow cannot be reused as a zero-knowledge recovery mechanism.

The replacement protocol must:
- Generate high-entropy recovery material in the browser using a cryptographically secure RNG.
- Derive a recovery wrapping key client-side using a reviewed KDF and unique salt.
- Wrap the DEK with the recovery key; store only the wrapped DEK and bounded public KDF metadata on the server.
- Require explicit confirmation that the user saved the recovery material.
- Permit recovery to unwrap the DEK and re-wrap it under a new Master Password without exposing the DEK or recovery material to the server.
- Define rotation, revocation, interrupted recovery, lost-device, and lost-recovery behavior.
- Never create a hidden server master key or plaintext recovery-code escrow.

The exact recovery encoding, entropy, KDF parameters, envelope format, and state machine require a separate review and tests before implementation. See [Argon2id Browser Library Review](ARGON2ID-LIBRARY-REVIEW.md); no KDF package has been selected or installed.

## 6. Cryptographic envelope requirements

- AES-256-GCM through the browser Web Crypto API.
- Fresh random 96-bit nonce for every encryption under a given DEK.
- Authentication tag verified before any plaintext is used.
- AAD binds the ciphertext to the immutable vault ID, record ID, record type, and format version.
- Versioned, strictly validated envelope metadata; reject unknown versions and malformed or oversized values.
- Argon2id from a maintained, reviewed implementation. Do not implement a KDF or cipher manually.
- Benchmark and set bounded Argon2id parameters on supported mobile devices; never trust arbitrary KDF parameters supplied by stored records.
- Keep keys in memory only while unlocked; lock on sign-out, explicit lock, and inactivity. Document that JavaScript cannot guarantee memory zeroization.
- Do not persist Master Passwords or unwrapped keys in localStorage, sessionStorage, IndexedDB, cookies, URLs, logs, or analytics.

## 7. Migration sequence

### Phase A — Containment and consistency
- Keep the existing Preview marked as an unsafe development prototype for real secrets.
- Reconcile product and security documentation with this target.
- Keep all work on `feature/vault-authentication`.

### Phase B — Isolated crypto protocol
- Select and pin a maintained Argon2id browser implementation.
- Specify versioned key metadata and ciphertext envelope.
- Implement browser-only crypto utilities with unit tests before wiring the UI.
- Test round trips, wrong password, tampering, wrong AAD, malformed envelopes, nonce uniqueness, and KDF parameter limits.

### Phase C — Authentication and recovery separation
- Separate Supabase authentication from vault unlocking.
- Replace server-side Recovery Code escrow with the reviewed client-side recovery envelope.
- Test login without unlock, unlock without session, recovery, revocation, and interrupted flows.

### Phase D — Ciphertext-only API and storage
- Change create/read/update API routes so they validate and store opaque ciphertext only.
- Remove server-side decryption and the server-side account-data encryption key.
- Preserve user ownership checks and no-store responses.
- Inspect browser network requests and server logs to prove plaintext secrets and usable keys never cross the trust boundary.

### Phase E — Data migration and hardening
- Do not attempt to convert old server-encrypted records unless a safe, user-mediated client migration is designed and tested.
- Inspect the actual database state before any schema migration.
- Test RLS, cross-user isolation, CSRF, XSS/CSP, rate limits, backups, restore, and key rotation.
- Remove legacy Gmail and server-encryption code only after references, tests, and migration safety are established.

### Phase F — Release gates
- CI, typecheck, tests, and production build pass.
- Security review confirms the server cannot decrypt stored records.
- Recovery and encrypted backup are independently reviewed and tested.
- No critical/high findings remain unresolved.
- Preview verification is complete.
- Production deployment, production secrets, and production database changes each require separate explicit approval.

## 8. Non-goals and safety rules

- No Gmail or provider integrations.
- No AI, analytics, advertising, categories, notes, or unnecessary dashboard features.
- No custom cryptography.
- No claim that the application is "unhackable".
- No real account credentials in the current Preview.
- No production database changes, production secret changes, merge to `main`, or production deployment as part of this plan.
