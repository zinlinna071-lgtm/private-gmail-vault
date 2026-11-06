# Authenticator & Recovery Vault — Security Design

Status: design proposal only. No database migration or authenticator code is included in this document.

## Goal

Store Google Authenticator TOTP seeds and Google backup codes for each Google identity so the owner can recover access from a new device after losing a phone or SIM. This is separate from Gmail API access. It does not approve Google Prompts, bypass Google's 2-Step Verification, reset a Google password, or override Google's account-recovery decisions.

## Findings in the current branch

- Gmail OAuth refresh tokens are encrypted server-side with AES-256-GCM using VAULT_ENCRYPTION_KEY.
- The current Recovery Code is stored as a scrypt hash; a pending replacement is temporarily encrypted so it can be shown again after a lost response.
- The current recovery code is one-time and rotates after recovery. It is not yet a cryptographic key-encryption mechanism.
- There is no TOTP/authenticator feature or backup-code storage table yet.
- The existing VAULT_ENCRYPTION_KEY is a server secret. Using it as the only protection for authenticator seeds would mean a database backup alone is insufficient to reveal seeds, but a server-key compromise would expose all stored factors. It would not provide user-controlled, portable encryption.

## Recommended security model: client-side envelope encryption

Use a random 256-bit Vault Data Key (VDK) generated in the browser when the owner first enables the Authenticator Vault.

1. Encrypt each TOTP seed and each Google backup-code collection with AES-256-GCM under the VDK. Use a fresh random 96-bit IV per encryption and authenticated additional data that binds ciphertext to the Vault user, factor ID, purpose, and schema version.
2. Never send plaintext seeds or backup codes to application APIs. Upload only ciphertext, IV, authentication tag, and non-secret metadata.
3. Wrap the VDK twice, independently:
   - Master Password wrapper: derive a wrapping key from the Master Password with a reviewed Argon2id implementation, unique random salt, and versioned parameters.
   - Recovery Code wrapper: derive a second wrapping key from the high-entropy Recovery Code with a separate salt and the same reviewed KDF; use it only for recovery.
4. The browser unlocks the VDK after the owner re-enters the Master Password or Recovery Code. Keep plaintext key material and decrypted factor values in memory only. Clear them on sign-out, lock, tab close, and a short inactivity timeout. Do not use localStorage, sessionStorage, analytics, logs, or AI services for secrets.
5. Generate 6-digit TOTP codes in the browser using RFC 6238 (Google-compatible SHA-1, 30-second period, 6 digits unless the enrolled factor explicitly specifies otherwise). Display remaining time and allow copy. The decrypted seed stays in memory only while unlocked.
6. Keep Google backup codes encrypted as a structured collection with per-code used/unused state. Reveal only after an explicit user action. Marking a code used must re-encrypt the collection under the VDK; never store plaintext codes or their partial values in audit metadata.

### Key rotation and recovery invariants

- Master Password change: re-wrap the same VDK with a new password-derived key; do not re-encrypt every factor.
- Recovery Code rotation: create the new recovery wrapper first. Keep the old wrapper usable until the new Recovery Code has been explicitly acknowledged, then atomically replace the old wrapper and retire the old code. The current recovery acknowledgement flow is a useful pattern, but it must be extended to the VDK wrapper.
- Recovery using the old Recovery Code: unwrap the VDK in the browser, set a new Master Password, create both new wrappers, and only then finalize the recovery-code rotation.
- If both the Master Password and the current Recovery Code are lost, encrypted factors are intentionally unrecoverable. There must be no hidden server bypass.
- Losing access to the Google Authenticator seed and every unused Google backup code may still require Google's official account recovery process.

## Proposed data model (not applied)

### vault_key_envelopes — one row per Vault user

- user_id UUID primary key, references auth.users
- password_wrapped_key_ciphertext, password_wrapped_key_iv, password_wrapped_key_tag
- password_kdf_name, password_kdf_salt, password_kdf_parameters, password_wrapper_version
- recovery_wrapped_key_ciphertext, recovery_wrapped_key_iv, recovery_wrapped_key_tag
- recovery_kdf_name, recovery_kdf_salt, recovery_kdf_parameters, recovery_wrapper_version
- created/updated timestamps

### vault_auth_factors — one row per Google identity/factor

- id UUID primary key; user_id UUID owner
- provider (initially google), google_subject, account_email, optional user label
- totp_ciphertext, totp_iv, totp_auth_tag
- backup_codes_ciphertext, backup_codes_iv, backup_codes_auth_tag (encrypted structured collection)
- totp_algorithm, totp_digits, totp_period_seconds
- created/updated timestamps and optional disabled timestamp

Use a uniqueness constraint on (user_id, provider, google_subject). Do not make factor deletion depend on a Gmail OAuth connection being active: OAuth access may be revoked while the owner still needs the saved 2FA recovery material. Apply RLS, revoke browser table grants, and access rows only through authenticated server routes that always scope by the Vault user's UUID. Never return raw ciphertext or factor metadata for another user.

## Enrollment workflow

1. Owner chooses an already-connected Google identity or enters a clearly labeled Google account identity.
2. Browser generates a random TOTP seed and shows an otpauth QR code plus a manual secret reveal. The user enrolls that seed in Google Authenticator (or a compatible authenticator app).
3. Owner enters the first generated 6-digit code to prove enrollment. Only then save the encrypted seed.
4. Owner manually imports/generates Google backup codes through Google's official security settings and enters them into the Vault. Do not pretend the Gmail API can retrieve Google's backup codes.
5. Encrypt the backup-code collection locally, verify it can be decrypted, then show a one-time confirmation that setup is complete.
6. Provide explicit lock, reveal, copy, mark-used, replace, and delete actions with re-authentication for high-risk operations.

## Before implementation

- Evaluate and pin a maintained, audited Argon2id implementation that works in the browser; do not silently substitute a weak or unreviewed KDF.
- Define canonical AAD encoding and versioning tests before persisting ciphertext.
- Add tests for RFC 6238 known vectors, wrong-password and wrong-recovery-code failures, ciphertext tampering, cross-user isolation, key rotation, lost-response acknowledgement, and secret-free logs.
- Add rate limits and same-origin checks to all state-changing routes.
- Add security audit events containing action/outcome/factor ID only—never seeds, backup codes, derived keys, QR payloads, or plaintext.
- Review the Google account's 2-Step Verification settings separately. The Vault cannot obtain an existing TOTP secret from Google after the fact; enrollment must be done in advance.

## Approval boundary

This document does not change the database, OAuth scopes, existing recovery flow, or production environment. A separate migration and implementation plan must be reviewed and explicitly approved before applying any SQL or changing the current recovery protocol.
