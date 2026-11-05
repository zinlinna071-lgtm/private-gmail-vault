# Supabase Setup

The Private Gmail Vault Supabase project has been created separately from GitHub. Configure it using the Supabase dashboard; never send secret values through chat.

## Apply migrations
The initial schema migration has already been applied and the three base tables were confirmed in Table Editor:
- vault_profiles
- gmail_connections
- vault_audit_events

For independent Vault Login, apply the next migration:
1. Open the Supabase SQL Editor.
2. Open supabase/migrations/202611060002_vault_auth_credentials.sql on branch feature/vault-authentication.
3. Copy the complete SQL into a new SQL Editor query and run it.
4. Confirm vault_profiles has login_id, recovery_code_hash, and recovery_code_salt.
5. Confirm vault_auth_rate_limits exists.
6. Confirm consume_vault_auth_attempt exists.

Do not create broad authenticated-user policies for Gmail token or rate-limit tables.

## Environment variables
Configure these in Vercel or local .env.local:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY (server only)
- VAULT_ENCRYPTION_KEY (server only; 32 random bytes encoded as base64)

The code temporarily accepts the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY variable names as fallbacks. New configuration should use publishable and secret key names.

Generate the encryption key locally:
```sh
openssl rand -base64 32
```

Never send secrets through chat or GitHub issues.

## Authentication design
- Vault Login ID is a username, not an email address.
- Supabase Auth uses an internal synthetic .invalid email identifier derived from the Login ID. It is not a real mailbox.
- Accounts are created server-side with email confirmed; no external email address is required.
- Recovery uses a one-time code whose scrypt hash and salt are stored in vault_profiles.
- Recovery rotates the code; the new code is shown once and must be saved offline.
- Login, registration, and recovery use database-backed per-IP and per-account rate limits.

## Important
The admin client bypasses RLS. Scope every user-data query by the authenticated user's UUID. Never expose the admin client to a browser.
