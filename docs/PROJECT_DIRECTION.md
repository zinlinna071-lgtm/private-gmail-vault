# Private Account Vault — Project Direction

**Status:** Current agreed product scope and security direction  
**Branch:** `feature/vault-authentication`

## Purpose

A simple personal vault for manually storing credentials belonging to any account. It does not connect to Gmail or other providers.

## Only the essential features

1. Create and sign in to a private Vault account.
2. Unlock the encrypted vault independently of server authentication.
3. Add an account with:
   - Account name
   - Email or username
   - Password
   - Backup codes
4. Search saved accounts.
5. Show, hide, and copy passwords or backup codes.
6. Edit or delete an account.
7. Sign out and lock the vault.

No categories, notes, website integrations, Gmail API, AI, analytics, inbox, automation, ads, or extra dashboard.

## Security direction

The required target is a zero-knowledge design:
- Encrypt and decrypt complete account records in the browser before data leaves the client.
- Use Web Crypto AES-256-GCM with unique random nonces and authenticated additional data.
- Use a vetted Argon2id implementation to derive a key-encryption key from a client-only Master Password.
- Generate a random data-encryption key in the browser and wrap it under the derived key.
- Store only ciphertext and strictly validated, versioned cryptographic metadata on the server.
- Keep Supabase authentication separate from vault unlocking. The Master Password must never be sent to Supabase or any API.
- Replace server-side Recovery Code escrow with an independently reviewed client-side recovery protocol.
- Authenticate every API request and scope every database operation to the signed-in Vault user's ID.
- Do not cache credential API responses or write secrets to logs.

**Current implementation warning:** The existing code still uses server-side encryption and currently sends the account fields to the API as plaintext JSON before the server encrypts them. The existing login flow also sends the Vault password to Supabase Auth. The zero-knowledge design is not implemented yet. Do not store real high-value credentials in the current Preview.

See [Security Foundation](SECURITY-FOUNDATION.md) and [Client-Side Encryption Migration Plan](CLIENT-SIDE-ENCRYPTION-MIGRATION.md) for implementation requirements and release gates.

## Database

The target database stores encrypted account payloads only, plus the minimum metadata needed for ownership, versioning, and synchronization. Plaintext account fields must never be stored in database columns.

## Working rules

- Continue on `feature/vault-authentication`.
- Do not edit or merge `main`.
- Do not deploy production.
- Do not apply migrations to production or change live secrets without separate explicit approval.
- Keep the user interface minimal and do not add features outside the list above.
- Test authentication, record ownership isolation, client-side encryption, recovery, CRUD behavior, type checking, and production build before any release.
