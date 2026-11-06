# One-Time Google Connection and Automated Gmail Management

Date: 2026-11-06
Branch: `feature/vault-authentication`
Product: `Private Gmail Vault`

## User-approved product direction

The owner's intended workflow is deliberately simple:

1. The owner initiates **Connect Google** and chooses the Google Account.
2. Google performs its own authorization and any verification it requires.
3. The owner grants the requested Google permissions.
4. The application securely stores and manages the resulting authorization credentials.
5. The application performs supported Gmail-management tasks automatically while authorization remains valid.

The product principle is:

**One-Time Google Authorization → Automated Gmail Management**

"One-time" describes the intended user experience, not a promise that Google will never ask the owner to reauthorize. Google may require additional verification or consent if a token expires, is revoked, becomes invalid, or a risk/security policy requires it.

## Responsibility boundaries

### Google remains responsible for
- Google Account sign-in and identity verification.
- Google Prompt, passkeys, security keys, Authenticator, SMS, recovery email, backup codes, and other verification options that Google chooses to offer.
- OAuth consent and scope grants.
- Token revocation, expiration, and any required reauthorization.

The application must not simulate, bypass, intercept, or claim to complete Google's verification on the owner's behalf.

### Private Gmail Vault is responsible for
- Initiating the official Google OAuth flow.
- Requesting only the Gmail permissions needed for enabled features.
- Verifying the granted scopes and Google account identity on the server.
- Encrypting refresh tokens at rest and keeping secrets server-side.
- Refreshing access tokens securely when permitted by Google.
- Managing connected-account status and detecting authorization failures.
- Providing clear recovery and reconnect guidance when Google requires owner action.
- Performing Gmail operations only within the granted scopes and explicit product settings.
- Keeping an audit trail for security-sensitive actions.

## Automation expectations

Once a connection is valid, routine supported operations should not require the owner to repeat Google sign-in or enter a new verification code for every request. The app should use the stored OAuth grant and refresh flow as designed by Google.

The app must not promise uninterrupted access. It must handle at least:
- expired access tokens;
- revoked or invalid refresh tokens;
- missing or insufficient scopes;
- temporary Google API/network failures;
- account disconnection and reconnection;
- explicit owner confirmation for sensitive or irreversible operations where appropriate.

## Vault authentication is separate

The Vault's own login and recovery mechanisms (for example, Master Password, authenticator-based MFA, and recovery procedures) protect access to the Vault. They do not replace Google's authentication and do not grant the Vault authority to bypass Google's 2-Step Verification.

A user who loses their phone or SIM may still regain access to the Vault using its configured recovery methods. However, if Google independently requires fresh verification or revokes the OAuth grant, the owner must complete Google's approved process.

## Current implementation status

This document records the approved product direction; it does not claim that the full workflow is already implemented.

Existing work includes a Google OAuth connect/callback foundation, server-side refresh-token encryption, granted-scope checks, and mocked callback tests.

Remaining implementation work includes:
- completing callback hardening and regression coverage;
- secure access-token refresh and Gmail API client;
- account status and reconnect lifecycle;
- Gmail read/search and later management operations;
- robust audit logging and operational error handling;
- end-to-end tests with a disposable test account and explicit owner authorization.

## Safety and release constraints

- Continue on `feature/vault-authentication`.
- Do not edit or merge `main` without explicit instruction.
- Do not deploy to production without explicit instruction.
- Do not use live Gmail credentials or production data for mocked tests.
- Never log or expose authorization codes, access tokens, refresh tokens, client secrets, or encryption keys.
