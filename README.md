# Private Account Vault

A minimal private vault for storing credentials for any account.

## What it does

- Create a private Vault login.
- Save an account name, email or username, password, and backup codes.
- Search, reveal, conceal, copy, edit, and delete saved accounts.

No Gmail connection, provider integration, AI, analytics, advertising, or unnecessary dashboard.

## Security status

The long-term security target is a **zero-knowledge, client-side encrypted vault**. The governing design and release requirements are documented in [Security Foundation](docs/SECURITY-FOUNDATION.md). The public-facing, read-only reporting concept is documented in [Security Transparency Dashboard](docs/SECURITY-TRANSPARENCY-DASHBOARD.md); the current branch also includes an initial `/security` page backed only by published test evidence. The personal crypto research fund disclosure and proposed blockchain verification/accounting model are documented in [Crypto Donation Fund](docs/CRYPTO-DONATION-FUND.md); the `/support` page is static and no donation intake is active.

**Important implementation status:** Do not assume the zero-knowledge target is already implemented. The current codebase has used server-side encryption at rest, which means the server can access the encryption key when serving secrets. Until the client-side encryption phase is implemented, independently tested, and verified in the deployed build, this application must not be used to store high-value real credentials.

The security foundation requires:
- Client-side encryption with a reviewed key hierarchy and authenticated encryption.
- A server that stores ciphertext and cannot decrypt vault records.
- Passkey/WebAuthn for phishing-resistant authentication, separate from encryption keys.
- An independently reviewed recovery and encrypted-backup protocol.
- Strict authorization, browser security, supply-chain controls, and security tests.
- No absolute or "unhackable" security claims.

## Setup

1. Configure a dedicated Supabase project.
2. Review all migrations and apply them in order only after confirming the target database and its existing migration state.
3. Configure required server-only environment variables using the project's setup documentation. Never place secret keys in client-side variables or commit them to source control.
4. Install dependencies and run:
   - `npm install`
   - `npm run typecheck`
   - `npm test`
   - `npm run build`
   - `npm run dev`

Do not deploy until the intended database, authentication, authorization, encryption, recovery, and release gates have been reviewed and tested. Production deployment requires explicit approval.

## Project boundaries

This project is for personal account-secret storage only. It does not connect to Gmail or other account providers, sign in to external services, or bypass any provider's security checks.
