# Gmail Refresh-Token Encryption Versioning Design

Date: 2026-11-06
Branch: `feature/vault-authentication`
Status: implementation staged on this feature branch; additive migration file is committed but NOT applied. No secrets, live database rows, Gmail tokens, main branch, merge, or production deployment have been changed.

## 1. Verified current schema and implementation

The initial schema at `supabase/migrations/202611060001_initial_vault_schema.sql` defines:

```sql
encryption_key_version integer not null default 1 check (encryption_key_version > 0)
```

The column is therefore an integer, non-null, positive, and defaults to version 1. The setup guide says the initial schema has been applied to the current Supabase project. This design does not independently inspect the live database.

Current implementation observations:
- `encryptRefreshToken` encrypts with AES-256-GCM using `VAULT_ENCRYPTION_KEY` and returns `keyVersion: 1`.
- `decryptRefreshToken` always uses `VAULT_ENCRYPTION_KEY`; it accepts no version or authenticated context.
- The OAuth callback lookup omits `encryption_key_version`. When Google omits a new refresh token, the callback reuses the previous ciphertext but writes version 1.
- The Gmail messages route omits `encryption_key_version` from its select and does not pass a version to decryption.

## 2. Goals and invariants

1. Every stored refresh token is decrypted only with the key version that encrypted it.
2. Unknown, missing, malformed, or retired key versions fail closed; never guess a key.
3. Reusing an existing ciphertext must preserve its exact key version and encryption-format version.
4. New encryption uses one explicitly configured active key version.
5. Old keys remain available until all ciphertext using them is safely re-encrypted and verified.
6. No key material is stored in the database, browser, source control, logs, or chat.
7. No live ciphertext is bulk-rotated as part of the initial code deployment.
8. OAuth state-signing material and Gmail token-encryption material must be independently rotatable.

## 3. Separate key identity from ciphertext format

The existing `encryption_key_version` identifies the encryption key. It must not be overloaded to identify the ciphertext format.

Add a separate positive integer `encryption_format_version` to `gmail_connections` in a separately reviewed additive migration:
- Format 1: legacy AES-256-GCM ciphertext, no AAD; existing records are backfilled to 1 only after a schema/data preflight confirms the current legacy format.
- Format 2: AES-256-GCM with canonical AAD binding the ciphertext to the Vault user, Google subject (or immutable connection identity), purpose `gmail-refresh-token`, and format version 2.

AAD fields must be encoded unambiguously (for example, a canonical JSON object with fixed property order or length-prefixed fields). The exact identity fields must remain stable across account email changes. Prefer `user_id`, `google_subject`, purpose, and format version; do not bind mutable display name or email address.

## 4. Keyring configuration proposal

Use server-only, purpose-specific configuration rather than sharing the OAuth state HMAC key:
- `GMAIL_TOKEN_ENCRYPTION_ACTIVE_KEY_VERSION`: positive integer selecting the key used for new ciphertext.
- `GMAIL_TOKEN_ENCRYPTION_KEY_V1`, `GMAIL_TOKEN_ENCRYPTION_KEY_V2`, ...: each exactly 64 hex characters (32 random bytes).
- `GMAIL_TOKEN_ENCRYPTION_ACTIVE_FORMAT_VERSION`: `1` (legacy no-AAD) or `2` (AAD-bound); defaults to `1`.
- `GMAIL_OAUTH_STATE_HMAC_KEY`: separate 32-byte key for OAuth state signatures.

Compatibility phase:
- Existing records with key version 1 must continue to decrypt with the currently configured legacy `VAULT_ENCRYPTION_KEY` until an operator deliberately provisions the equivalent version-1 key under the new purpose-specific setting.
- Do not silently fall back from an unknown version to the active key.
- Do not remove the legacy key or repurpose it for OAuth state until all dependent data and signatures have expired or been migrated under an approved plan.

These settings require a deployment runbook and secret-manager changes before preview or live rollout. Secret values must never be copied into GitHub or chat.

## 5. Application contract

Implemented helper contracts on this branch (still subject to CI and code review):
- `encryptRefreshToken(token, context)` returns ciphertext, IV, tag, keyVersion, and formatVersion.
- `decryptRefreshToken(envelope, context)` requires ciphertext, IV, tag, keyVersion, and formatVersion.
- Key resolver accepts only an explicit positive integer and returns the exact configured key for that version.
- Format 1 decrypts with the legacy no-AAD behavior.
- Format 2 sets the exact canonical AAD before finalization and rejects any identity/context mismatch.

Callback behavior:
- Select ciphertext, IV, tag, key version, and format version from the existing connection.
- If Google supplies a new refresh token, encrypt it with the configured active key and format.
- If Google omits a new refresh token, preserve all old envelope fields exactly, including both versions. Do not relabel legacy ciphertext as a newer key or format.

Gmail read behavior:
- Select both versions with the encrypted token fields.
- Validate both versions before decrypting.
- Pass authenticated user ID and stable Google subject into decryption context.
- Do not return encryption metadata or provider credential material to the browser.

## 6. Safe rollout sequence

1. Preflight the actual live schema and record counts using read-only queries; confirm all rows have positive key versions and determine whether any version other than 1 exists. Never retrieve or print token ciphertext or secrets for this preflight.
2. Review the additive migration for `encryption_format_version`; do not apply it until separately approved.
3. Add unit tests for key resolver behavior, format-1 compatibility, format-2 AAD binding, unknown versions, missing keys, tampering, and cross-user/context mismatch.
4. Add callback regression tests proving that omitted Google refresh tokens preserve ciphertext, IV, tag, key version, and format version exactly.
5. Add Gmail read-route tests proving it selects and passes both versions and fails closed on unknown versions.
6. Implement compatibility code while keeping format 1 readable and the existing active key unchanged.
7. Deploy only to a disposable preview/test environment and verify with synthetic OAuth tokens. Never use production refresh tokens for test fixtures.
8. Only after explicit approval, provision a new key and enable format 2 for newly issued/reconnected tokens.
9. Re-encrypt old records in a separately controlled, resumable job with per-row verification and audit records. Keep old keys until every row is verified and rollback windows expire.
10. Retire an old key only after a read-only inventory proves no live row requires it and rollback requirements are met.

## 7. Required tests

- Key version 1 resolves to the legacy key during compatibility.
- A configured newer version encrypts new tokens using that exact key.
- Unknown, zero, negative, non-integer, or unconfigured versions fail closed.
- A format-1 token remains decryptable without AAD.
- A format-2 token decrypts only with matching user ID, Google subject, purpose, and format version.
- Tampered ciphertext, IV, tag, or AAD fails authentication.
- Callback with no new refresh token preserves all old encrypted fields and both version columns.
- Callback with a new refresh token stores the active key and format versions.
- Gmail read route passes stored versions and never falls back to the active key.
- No credentials, ciphertext, key values, or raw provider response bodies appear in browser responses or logs.

## 8. Explicit non-changes

The current feature-branch implementation does not:
- apply the additive database migration (it is only a committed SQL file);
- change any Vercel environment variable or secret;
- access the live Supabase database or Google account;
- rotate or re-encrypt any stored token;
- modify `main`, merge the PR, or deploy production.

## 9. Approval gates

Before preview deployment or live rollout, separately approve:
- provisioning `GMAIL_TOKEN_ENCRYPTION_KEY_V1` with the exact existing legacy key value (never send it in chat or GitHub), and `GMAIL_OAUTH_STATE_HMAC_KEY` as a separately generated 32-byte secret;
- applying migration `202611060004_gmail_token_encryption_format_version.sql` after read-only live-schema/data preflight;
- any active key version or format change from defaults (1/1).

Before any live key provisioning, database migration, or token re-encryption, obtain a separate explicit approval for that operational change.
