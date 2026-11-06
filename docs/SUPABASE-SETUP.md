# Supabase Setup

The Private Gmail Vault Supabase project has been created separately from GitHub. Configure it using the Supabase dashboard; never send secret values through chat.

## Apply migrations
The initial schema migration has already been applied and the three base tables were confirmed in Table Editor:
- vault_profiles
- gmail_connections
- vault_audit_events

The initial schema migration (001) and independent Vault credentials migration (002) have been applied to the current Supabase project and their resulting tables/columns were checked.

Migration 003 (recovery claims and encrypted pending Recovery Codes) is present in the feature branch but has **not** been applied. Do not run it until the Recovery Flow review and automated checks are complete and the migration is explicitly approved.

Migration 004 (Gmail token encryption format version) is present in the feature branch but has **not** been applied. It adds the `encryption_format_version` column required by the updated Gmail callback and read API. Do not apply it until a read-only live schema/data preflight is completed and the migration is separately approved. Do not deploy the feature branch against a database that has not applied the required migration.

The expected result after migration 002 is:
- vault_profiles includes login_id, recovery_code_hash, and recovery_code_salt.
- vault_auth_rate_limits exists.
- consume_vault_auth_attempt exists.

Do not create broad authenticated-user policies for Gmail token or rate-limit tables.

## Environment variables
Configure these in Vercel or local .env.local:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
- SUPABASE_SECRET_KEY (server only)
- VAULT_ENCRYPTION_KEY (server only; existing legacy key, exactly 64 hexadecimal characters representing 32 random bytes)
- GMAIL_TOKEN_ENCRYPTION_KEY_V1, GMAIL_TOKEN_ENCRYPTION_KEY_V2, etc. (server only; each exactly 64 hexadecimal characters; V1 must be byte-for-byte equivalent to the existing legacy key before it is configured)
- GMAIL_TOKEN_ENCRYPTION_ACTIVE_KEY_VERSION (server only; positive integer; defaults to 1)
- GMAIL_TOKEN_ENCRYPTION_ACTIVE_FORMAT_VERSION (server only; 1 or 2; defaults to 1)
- GMAIL_OAUTH_STATE_HMAC_KEY (server only; separate 32-byte random key, exactly 64 hexadecimal characters; do not reuse the Gmail token encryption key)

The code temporarily accepts the legacy NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY variable names as fallbacks. New configuration should use publishable and secret key names.

Generate the encryption key locally (the application expects 64 hexadecimal characters, not Base64):
```sh
openssl rand -hex 32
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
