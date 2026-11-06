# Private Account Vault — Project Direction

**Status:** Current agreed scope  
**Branch:** `feature/vault-authentication`

## Purpose

A simple private vault for storing login details for any kind of account. It does not connect to Gmail or other providers.

## Only the essential features

1. Create a Vault using a private Login ID and Master Password.
2. Add an account with:
   - Account name
   - Email or username
   - Password
   - Backup codes
3. Search saved accounts.
4. Show, hide, and copy passwords or backup codes.
5. Edit or delete an account.
6. Sign out.

No categories, notes, website integrations, Gmail API, AI, analytics, inbox, automation, or extra dashboard.

## Security

- Use the existing independent Vault sign-in and Recovery Code.
- Encrypt each complete account record with AES-256-GCM before database storage.
- Use a unique random IV for each encryption.
- Bind authenticated encryption to the Vault user ID and account record ID.
- Keep the account-data encryption key server-only and separate from the Recovery Code encryption key.
- Authenticate every request and scope every database operation to the signed-in Vault user's ID.
- Do not cache credential API responses or write secrets to logs.
- Never request, store, or expose a user's third-party account password outside this Vault.

The initial implementation uses server-side encryption at rest. The hosting server must access the encryption key to return credentials to the owner, so this is not zero-knowledge encryption. A future zero-knowledge design would require a separate approved project because it changes key recovery and password-reset behavior.

## Database

The new `vault_items` table stores only:
- Record ID
- Vault user ID
- Encrypted ciphertext
- IV
- Authentication tag
- Created and updated timestamps

Plaintext account fields must never be stored in database columns.

## Required environment

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server only)
- `VAULT_ENCRYPTION_KEY` (Recovery Code protection; server only)
- `VAULT_DATA_ENCRYPTION_KEY` (account record encryption; server only)

Both encryption keys must be generated from 32 cryptographically random bytes, represented as 64 hexadecimal characters, stored securely, and kept separate.

## Working rules

- Continue on `feature/vault-authentication`.
- Do not edit or merge `main`.
- Do not deploy production.
- Do not apply migrations to production or change live secrets without separate explicit approval.
- Keep the user interface minimal and do not add features outside the list above.
- Test authentication, record ownership isolation, encryption, CRUD behavior, type checking, and production build before any release.
