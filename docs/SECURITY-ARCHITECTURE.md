# Security Architecture

## Trust boundaries
- The browser is untrusted. It must never receive Google refresh tokens, encryption keys, Supabase service-role keys, or OAuth client secrets.
- Supabase Auth identifies the vault user. Every server operation must validate the current session.
- Server-side privileged database operations must explicitly filter by the authenticated user's UUID.
- Gmail access uses Google's official OAuth 2.0 and Gmail API. Google's account security and reauthorization requirements remain in force.

## OAuth token handling
- Request only the Gmail scopes required for each feature.
- Request offline access only when persistent access is necessary and explain this clearly.
- Encrypt refresh tokens with AES-256-GCM before storing them.
- Store ciphertext, a unique 96-bit IV, the 128-bit authentication tag, and a key version.
- Keep the 32-byte encryption key in a server-side secret manager, never in Supabase, source control, browser code, or logs.
- Do not persist short-lived access tokens without a documented need and expiry strategy.
- Never log OAuth responses, token values, Gmail message content, or authorization headers.

## Database access
- The initial migration enables RLS and grants no direct table privileges to anon or authenticated.
- Access is server-managed. Authenticate the user with their Supabase session, then use a server-only privileged client with explicit user_id scoping.
- Audit records may contain event types and safe identifiers only, never credentials or message content.

## Key rotation and recovery
- Key version is stored with each encrypted token to support controlled key rotation.
- Do not replace the active encryption key without a tested decrypt-and-reencrypt migration and a recoverable encrypted backup.
- A database backup without the corresponding encryption key is not sufficient to restore Gmail connections.
- Keep an offline, separately protected recovery copy of key material and recovery instructions.

## Before production
- Configure Supabase Auth with strong account recovery and MFA/passkeys where supported.
- Add CSRF/state/PKCE validation to OAuth flows and bind each OAuth attempt to the signed-in vault user.
- Add rate limits, session revocation, audit review, dependency scanning, and backup restore tests.
- Restrict Google OAuth redirect URIs to exact registered URLs.
- Never claim the vault bypasses Google's verification, account recovery, or token revocation controls.
