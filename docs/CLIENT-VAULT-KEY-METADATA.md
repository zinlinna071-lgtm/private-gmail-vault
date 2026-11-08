# Client Vault Key Metadata Schema

**Status:** Schema scaffold only; not wired to the application.
**Migration:** `202611080003_client_vault_key_metadata.sql`
**Production impact:** None. Source migration and disposable-database tests only.

## Purpose

Reserve a per-Vault metadata location for the future client-side encryption protocol. It stores only public KDF parameters and an AES-GCM-wrapped random DEK. It never stores the Unlock Secret, derived KEK, or raw DEK.

## Fields

- `client_crypto_version`: NULL for all existing/legacy profiles; version 1 is reserved for the future client-encrypted format.
- `client_kdf_algorithm`: fixed identifier `argon2id-v1.3`.
- `client_kdf_profile`: allowlisted profile ID 1 or 2. The production profile is not selected until mobile benchmarks and independent review.
- `client_kdf_salt`: Base64 encoding of a random 16-byte per-Vault salt.
- `client_wrapped_dek_iv`: Base64 encoding of a 12-byte AES-GCM nonce.
- `client_wrapped_dek`: Base64 encoding of a 32-byte DEK plus 16-byte GCM authentication tag.
- `client_key_created_at`: non-secret lifecycle timestamp.

A database CHECK constraint requires either all fields to remain NULL or a complete, correctly shaped version-1 envelope. It rejects unsupported profiles, malformed salt/nonce/ciphertext encodings, and partial metadata.

## Important boundaries

- Existing profiles remain legacy by default; no data is migrated.
- Active Vault CRUD remains server-readable and unchanged.
- This schema does not prove the API is ciphertext-only, does not prevent a server operator from changing public metadata, and does not provide recovery.
- The wrapped DEK is only useful with the user's separate Vault Unlock Secret. No Owner/support escrow or bypass is introduced.
- Profile IDs are experimental allowlist values, not production approval.
- The migration has not been applied to Supabase. Apply only after explicit owner approval and a reviewed rollout/rollback plan.
