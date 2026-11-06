# Private Gmail Vault

A private web application designed to let its owner sign in from a new device and manage multiple Gmail connections through Google's official OAuth 2.0 authorization and Gmail API.

## Current implementation

The `feature/vault-authentication` branch adds an independent Vault account:
- A unique Vault Login ID and Master Password; no Gmail address, phone number, or SIM is used as the Vault sign-in identity.
- A one-time Recovery Code generated at account creation and rotated after successful recovery.
- Server-side hashed Recovery Code storage and database-backed rate limits.
- Supabase Auth sessions stored through secure server-managed cookies.
- A private Vault page with Google OAuth 2.0 Gmail account connection. The initial connection requests read-only Gmail scope and stores the Google refresh token encrypted with AES-256-GCM. Mailbox browsing and message actions are separate future milestones.

## Security principles

- Never collect or store Gmail passwords.
- Use Google's official OAuth 2.0 flow and request only the minimum Gmail API scopes needed.
- Keep Google OAuth client secrets, refresh tokens, Supabase secret keys, and encryption keys on the server only.
- Encrypt stored refresh tokens with AES-256-GCM and keep encryption keys outside the database.
- Apply Supabase Row Level Security and scope every privileged query to the authenticated Vault user's UUID.
- Never promise access if Google revokes a token or requires identity verification. Only Google can satisfy Google's account recovery and verification checks.
- A lost Master Password can be reset with the Recovery Code. If both are lost, there is intentionally no hidden bypass.

## Supabase setup

Apply these migrations in order in the Supabase SQL Editor:

1. `supabase/migrations/202611060001_initial_vault_schema.sql`
2. `supabase/migrations/202611060002_vault_auth_credentials.sql`
3. `supabase/migrations/202611060003_recovery_claims.sql`

Migration 003 adds the recovery-claim lock and encrypted pending Recovery Code handoff. The current recovery code remains active until the newly issued code is explicitly acknowledged.

The application uses server-side Supabase admin access for private tables. Do not add browser-facing table grants or policies for these tables unless the architecture is deliberately changed and reviewed.

## Environment

Copy `.env.example` to `.env.local` and configure:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server only; never expose to the browser)
- `VAULT_ENCRYPTION_KEY` (server only; exactly 64 hexadecimal characters representing 32 cryptographically random bytes)
- `GOOGLE_CLIENT_ID` (Google Cloud OAuth 2.0 Web application client ID)\n- `GOOGLE_CLIENT_SECRET` (server-only OAuth client secret)\n- `GOOGLE_REDIRECT_URI` (exact HTTPS callback URL: `https://YOUR_PREVIEW_HOST/api/gmail/callback`)

Generate `VAULT_ENCRYPTION_KEY` securely and store it only in your local secret file or deployment secret manager. Do not paste it into chat, commit it, or change it without a planned re-encryption procedure for any encrypted pending data.

The Supabase Auth user uses an internal synthetic `.invalid` email identifier derived from the Login ID. It is not a real email inbox and is never used for email recovery. Do not enable email-confirmation workflows for this internal username flow; account creation is performed server-side with confirmed Supabase Auth users.

## Google OAuth setup\n\n1. Create or select a Google Cloud project and configure the OAuth consent screen.\n2. Create an OAuth 2.0 Client ID with application type **Web application**.\n3. Add the exact deployed callback URL to **Authorized redirect URIs**. It must match `GOOGLE_REDIRECT_URI` exactly, including scheme, hostname, and path.\n4. Add the client ID, client secret, and redirect URI to the Vercel **Preview** environment for the feature branch. Keep the client secret server-only.\n5. The current connection flow requests `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/gmail.readonly`. It does not request send, modify, or delete permissions.\n6. Verify the Google OAuth consent screen and any required test-user configuration before attempting the connection.\n\nThe callback validates a short-lived, user-bound OAuth state value, exchanges the authorization code server-side, verifies the Google account email, encrypts the refresh token with AES-256-GCM, and stores only the encrypted token. Access tokens are not persisted. If Google does not return a refresh token on a repeat authorization, an existing encrypted refresh token for that same Google subject is retained; otherwise the connection is not saved.\n\n## Local development

1. Install Node.js 20.9 or later.
2. Copy `.env.example` to `.env.local`.
3. Configure the Supabase variables directly in your local secret file or deployment secret manager.
4. Run `npm install`, `npm run typecheck`, `npm run build`, then `npm run dev`.

Never paste secret values into chat or commit them to GitHub. Do not deploy with placeholder environment values. This branch is not production-ready until the migrations are applied, deployment secrets are configured, and end-to-end security tests are completed.
