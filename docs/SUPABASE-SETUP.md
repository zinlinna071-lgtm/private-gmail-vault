# Supabase Setup

This project does not yet have a Supabase project connected. Create one before applying the migration.

## Create the project
1. Create a new Supabase project dedicated to Private Gmail Vault.
2. Choose a strong, unique database password and store it in a password manager.
3. Keep the project region close to the Vercel deployment region where practical.
4. In Project Settings → API, copy the project URL and anon/publishable key for application configuration.
5. Copy the service-role/secret key only into a server-side secret manager. Never place it in browser code or commit it.

## Apply the schema
1. Open the Supabase SQL Editor.
2. Paste and run the file at supabase/migrations/202611060001_initial_vault_schema.sql.
3. Confirm the three tables exist: vault_profiles, gmail_connections, and vault_audit_events.
4. Confirm Row Level Security is enabled on all three tables.
5. Do not create broad authenticated-user policies for the Gmail token table.

## Environment variables
Configure these only after the Supabase project exists:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server only; secret)
- VAULT_ENCRYPTION_KEY (server only; secret; 32 random bytes encoded as base64)

Generate the encryption key locally with a trusted cryptographic random generator, for example:
openssl rand -base64 32

Do not send the encryption key, service-role key, database password, Google client secret, refresh token, or any other secret in ChatGPT messages or GitHub issues.

## Important
The admin client bypasses RLS. Every route using it must first authenticate the user through Supabase Auth and explicitly filter every query by that user's authenticated UUID. The admin client is never safe to expose to a browser.
