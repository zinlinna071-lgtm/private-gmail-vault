# Private Account Vault

A simple private vault for storing account passwords and backup codes.

## What it does

- Create a private Vault Login ID and Master Password.
- Save an account name, email or username, password, and backup codes.
- Search saved accounts.
- Show or hide passwords and backup codes.
- Copy credentials when needed.
- Edit or delete saved accounts.

There is no Gmail connection, mailbox access, AI, analytics, or extra dashboard.

## Security

- Account entries are encrypted with AES-256-GCM before they are stored in the database.
- Each entry uses a unique random IV and authenticated data bound to its Vault user and record ID.
- The account-data encryption key is server-only and separate from the Vault Recovery Code key.
- Database access is restricted to server-side routes that verify the signed-in Vault user and filter every record by that user's ID.
- API responses containing credentials are marked no-store.
- Never log or expose passwords, backup codes, recovery codes, or encryption keys.

**Important:** This first version uses server-side encryption at rest. The hosting server must access the encryption key to display saved credentials, so this is not a zero-knowledge vault. A zero-knowledge design would require a more complex client-side key and recovery system.

## Setup

1. Configure a Supabase project.
2. Apply migrations in order:
   - `supabase/migrations/202611060001_initial_vault_schema.sql`
   - `supabase/migrations/202611060002_vault_auth_credentials.sql`
   - `supabase/migrations/202611060003_recovery_claims.sql`
   - `supabase/migrations/202611060004_gmail_token_encryption_format_version.sql` (legacy schema compatibility)
   - `supabase/migrations/202611060005_vault_items.sql`
3. Set these server/deployment environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `VAULT_ENCRYPTION_KEY`
   - `VAULT_DATA_ENCRYPTION_KEY`
4. Both encryption keys must be 64 hexadecimal characters (32 cryptographically random bytes). Keep them separate, server-only, and backed up securely.
5. Install dependencies and run:
   - `npm install`
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
   - `npm run dev`

Do not deploy until all migrations are applied to the intended database, both keys are configured, and authentication, authorization, encryption, and recovery tests pass.

## Project boundaries

This project is for personal account-secret storage only. It does not connect to Gmail or other account providers, sign in to external services, or bypass any provider's security checks.
