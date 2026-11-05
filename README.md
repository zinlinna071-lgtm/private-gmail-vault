# Private Gmail Vault

A private web application for managing access to multiple Gmail accounts through Google's official OAuth 2.0 authorization and Gmail API.

## Current status

The initial Next.js foundation is being prepared on the `setup/app-foundation` branch. No Gmail accounts, passwords, OAuth tokens, or production secrets should be added to this repository.

## Security principles

- Never collect or store Gmail passwords.
- Use Google's official OAuth 2.0 flow and request the minimum Gmail API scopes needed.
- Keep OAuth client secrets, refresh tokens, service-role keys, and encryption keys on the server only.
- Encrypt stored refresh tokens with authenticated encryption and keep encryption keys outside the database.
- Apply Supabase Row Level Security and verify ownership on every server-side operation.
- Add passkey-based vault authentication, rate limiting, short-lived sessions, audit events, and recovery procedures before production.
- Google may revoke OAuth grants or require additional verification. This application cannot bypass Google's account security or guarantee uninterrupted access.

## Local development

1. Install Node.js 20.9 or later.
2. Copy `.env.example` to `.env.local`.
3. Configure Supabase and Google OAuth only after reviewing the security setup.
4. Run `npm install`, then `npm run dev`.

Do not deploy with placeholder or example environment values.

## Planned milestones

1. Secure application foundation and deployment checks.
2. Supabase schema, Row Level Security, and server-only encryption.
3. Vault authentication and recovery.
4. Google OAuth connection flow and Gmail API read-only access.
5. Multi-account inbox, search, and account management.
6. Security review, backup/recovery drills, and production readiness.
