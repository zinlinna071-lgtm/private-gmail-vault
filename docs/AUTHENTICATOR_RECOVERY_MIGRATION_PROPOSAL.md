# Authenticator Vault — Migration & Implementation Proposal

Status: proposal only. This document is not executable SQL and does not authorize a migration or a change to the existing recovery protocol.

## Scope

Add encrypted storage for TOTP seeds and Google backup codes, independently of Gmail OAuth connection status. Preserve the existing Gmail account management, sign-in, and Recovery Code behavior until a separately approved implementation is ready.

Out of scope:
- Reading Google's existing TOTP secret or backup codes through Gmail API (Google does not expose these through Gmail API).
- Approving Google Prompts, bypassing 2-Step Verification, resetting Google passwords, or overriding Google's recovery checks.
- Any production database change in this proposal.

## Existing database conventions inspected

The current migrations:
- Enable RLS on Vault tables.
- Revoke browser-role table access from `anon` and `authenticated`.
- Grant privileged access to `service_role`.
- Use server routes with authenticated Vault sessions and server-side Supabase admin access.
- Keep Recovery Code hashes in `vault_profiles` and use RPCs for claim/finish/acknowledgement transitions.

The new tables should follow the same no-direct-browser-table-access convention. Server routes must always scope every query by the authenticated Vault user's UUID.

## Proposed schema

### 1. `vault_key_envelopes`

One row per Vault user. This stores only two independently encrypted wrappers around a random 32-byte Vault Data Key (VDK).

Columns:
- `user_id uuid primary key references auth.users(id) on delete cascade`
- Password wrapper: `password_wrapped_key_ciphertext text not null`, `password_wrapped_key_iv text not null`, `password_wrapped_key_auth_tag text not null`
- Password KDF metadata: `password_kdf_name text not null`, `password_kdf_version text not null`, `password_kdf_salt text not null`, `password_kdf_parameters jsonb not null`
- Recovery wrapper: `recovery_wrapped_key_ciphertext text not null`, `recovery_wrapped_key_iv text not null`, `recovery_wrapped_key_auth_tag text not null`
- Recovery KDF metadata: `recovery_kdf_name text not null`, `recovery_kdf_version text not null`, `recovery_kdf_salt text not null`, `recovery_kdf_parameters jsonb not null`
- `schema_version integer not null`, `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`

The KDF name/version/parameters are data, not trusted instructions. The server must validate them against a strict allowlist and hard upper bounds before returning or processing them. The browser must reject unsupported versions and parameters. Never permit arbitrary memory/time settings from a database row to trigger unbounded work.

### 2. `vault_auth_factors`

One row per Google identity enrolled by the Vault owner.

Columns:
- `id uuid primary key`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `provider text not null check (provider = 'google')`
- `google_subject text not null`
- `account_email text not null`
- `label text`
- TOTP encrypted fields: `totp_ciphertext text not null`, `totp_iv text not null`, `totp_auth_tag text not null`
- Backup collection encrypted fields: `backup_codes_ciphertext text`, `backup_codes_iv text`, `backup_codes_auth_tag text`
- TOTP settings: `totp_algorithm text not null default 'SHA1'`, `totp_digits smallint not null default 6`, `totp_period_seconds smallint not null default 30`
- `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`, `disabled_at timestamptz`

Constraints:
- Unique `(user_id, provider, google_subject)`.
- `totp_algorithm` allowlist initially only `SHA1`.
- `totp_digits` allowlist initially only 6.
- `totp_period_seconds` constrained to a small supported range; default 30.
- Encrypted values must be non-empty, bounded in length, and never plaintext.
- Backup-code ciphertext fields are either all null or all non-null.
- Index by `(user_id, created_at desc)`.

The factor must not reference `gmail_connections.id`. Revoking Gmail OAuth must not destroy the user's ability to use previously enrolled recovery material.

## Encryption contract

- Generate the VDK in the browser with a cryptographically secure random source; 32 bytes.
- Encrypt factor payloads with WebCrypto AES-256-GCM, a fresh 12-byte IV per encryption, and a 128-bit authentication tag.
- Use canonical, versioned AAD containing the Vault user UUID, factor UUID, purpose (for example `totp-seed` or `backup-codes`), and schema version. Define the exact byte encoding and test it before persisting data.
- Encrypt the structured backup-code collection as one payload. Include stable code IDs and used/unused state; do not store plaintext code fragments or checksums in metadata.
- Wrap the VDK separately for the Master Password and Recovery Code. The two wrappers must use different random salts and independently derived wrapping keys.
- No plaintext seed, backup code, QR payload, derived key, or VDK may be sent to an API, persisted in browser storage, written to logs, analytics, or audit metadata.
- Clear decrypted values and key references from application state on explicit lock, sign-out, tab close, and inactivity timeout. JavaScript cannot guarantee secure memory erasure; document this limitation and minimize lifetime.

## KDF decision gate

The original Argon2id choice is not approved. See the KDF evaluation in `AUTHENTICATOR_RECOVERY_DESIGN.md`. The current preferred proof-of-concept candidate is pinned `@noble/hashes` Scrypt, subject to exact-version review, Android/browser benchmarks, parameter bounds, and a focused security review. Do not add a dependency until that gate is explicitly approved.

## API and authorization outline

All routes are Node.js server routes, same-origin protected, non-cacheable, and require an authenticated Vault session except the narrowly scoped recovery bootstrap endpoints.

Proposed operations:
1. Create envelope: authenticated session, recent Master Password re-authentication, no existing envelope; accept only encrypted wrappers and allowlisted KDF metadata.
2. Read envelope: authenticated session; return wrappers and validated non-secret KDF metadata only.
3. Create factor: authenticated session; accept client-generated factor UUID, account identity metadata, and ciphertexts; enforce uniqueness and ownership.
4. Update factor: authenticated session; require ownership and re-authentication for secret replacement or deletion.
5. Delete factor: authenticated session; require explicit confirmation and recent re-authentication.
6. Update wrappers: authenticated session; replace wrappers using optimistic version checks so simultaneous tabs cannot silently overwrite newer wrappers.
7. Backup-code state update: browser decrypts and re-encrypts the entire collection; server stores only the new ciphertext and checks factor ownership/version.

Do not create a generic endpoint that returns every user's rows or accepts a caller-supplied `user_id` as authorization. Derive owner UUID only from the verified session.

## Recovery protocol change — separate approval required

The current Recovery Code recovery endpoint resets the Vault password and rotates the Recovery Code using server-side verification and a pending-code acknowledgement. It does not currently unwrap a VDK.

A safe future recovery transition must coordinate all of these as one recoverable state machine:
1. Validate and claim the existing Recovery Code using the existing server-side protections.
2. Let the browser use the entered old Recovery Code to derive the recovery wrapping key and authenticate/decrypt the existing recovery wrapper. The server must never receive the plaintext VDK.
3. Browser derives the new Master Password wrapper and new Recovery Code wrapper around the same VDK.
4. Server stages the new wrappers and pending Recovery Code without invalidating the old recovery wrapper/code.
5. User explicitly acknowledges saving the newly issued Recovery Code.
6. A single database transaction promotes the new Recovery Code hash/salt and new recovery wrapper together, then retires the old wrapper and pending state.
7. On timeout, lost response, failed decryption, or missing acknowledgement, preserve a clearly defined usable recovery path; do not leave a new password paired with an unusable recovery wrapper.

Before implementation, this state machine must be specified as concrete RPC inputs, state transitions, expiry behavior, retry semantics, concurrency rules, and failure tests. Do not simply extend the existing acknowledgement RPC by adding columns without proving atomicity.

## RLS, grants, and audit

- Enable RLS on both tables.
- Revoke all direct table privileges from `anon` and `authenticated`; grant only the server role required by the current architecture.
- Do not add permissive browser policies.
- Add updated-at triggers consistent with existing migrations.
- Audit only action, outcome, factor ID, and non-sensitive reason codes. Never log email if not needed, ciphertext, KDF input, TOTP seed, backup code, QR data, VDK, or plaintext.
- Ensure foreign keys cascade only on Vault user deletion; factor deletion is explicit and auditable.

## Implementation and verification sequence

1. Approve the KDF and encryption contract.
2. Review the exact migration SQL, including grants, RLS, constraints, indexes, and triggers.
3. Approve the recovery state machine and backward-compatibility behavior.
4. Add migration file on `feature/vault-authentication`; do not apply it to Supabase until separately authorized.
5. Implement pure browser crypto helpers and RFC 6238 TOTP known-vector tests.
6. Implement route authorization and ownership tests, including cross-user isolation.
7. Add enrollment UI with QR/manual enrollment and first-code verification.
8. Add backup-code import, reveal, copy, mark-used, replace, and delete flows.
9. Test wrong password/recovery code, tampering, AAD mismatch, wrapper rotation, duplicate identity, lost response, concurrent recovery, expiry, and secret-free logs.
10. Run dependency audit, tests, typecheck, production build, and a mobile-device performance test.
11. Review the diff and preview. Merge, deploy, or apply Supabase SQL only after the owner's explicit approval.

## Rollback and compatibility

- Do not remove or rewrite existing Recovery Code columns or RPCs in the first migration.
- New tables are additive. If the feature is disabled, existing Gmail Management and Vault sign-in must continue working.
- Never drop encrypted factor rows automatically during rollback.
- If a schema rollback is required after enrollment begins, preserve the encrypted data and use a forward-fix migration; dropping wrappers or factors can permanently destroy recovery access.
