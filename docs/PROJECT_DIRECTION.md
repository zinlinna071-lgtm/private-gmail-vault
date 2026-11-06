# Private Gmail Vault — Project Direction

**Document status:** Agreed product direction  
**Last updated:** 2026-11-06  
**Working branch:** `feature/vault-authentication`  
**Repository:** `zinlinna071-lgtm/private-gmail-vault`

## 1. Product vision

Private Gmail Vault is a personal, owner-operated web application with two equally important purposes:

1. **Gmail Management:** securely access and manage the owner's connected Gmail accounts from the Vault.
2. **Authentication & Recovery Vault:** securely store and retrieve supported Google sign-in recovery factors, especially authenticator TOTP secrets and Google backup codes, so the owner can use them when signing in from a replacement device.

The product is not merely an inbox reader and not merely an OTP generator. Both capabilities belong in one secure personal Vault with one independent Vault login.

## 2. Core user scenarios

### A. Everyday Gmail use

1. Open the Vault website on a trusted device.
2. Sign in with the independent Vault Login ID and Master Password.
3. Select one of the previously connected Gmail accounts.
4. Read, search, and organize mail using the permissions the owner has explicitly granted.
5. Use supported mail actions such as reply, forward, compose/send, archive, label, star, and mark read as those capabilities are implemented and separately authorized.

### B. Lost phone / lost SIM / replacement device

1. Open the Vault website in a browser on a replacement phone or computer.
2. Sign in with the independent Vault credentials; this must not depend on the lost phone or SIM.
3. Select the relevant Gmail account in Authentication & Recovery.
4. Retrieve a current TOTP code generated from a secret that was securely enrolled and backed up in advance, or retrieve an unused Google backup code that was securely stored in advance.
5. Enter the code into Google's own sign-in challenge.
6. Complete any additional verification Google requires.

The Vault provides access to previously stored recovery factors. It does not itself approve Google's sign-in challenge or bypass Google's identity checks.

## 3. Main application areas

### 3.1 Overview
- Connected Gmail account status.
- Authentication setup/readiness status per account.
- Recent Vault security events.
- Warnings for missing or stale recovery setup and Gmail reauthorization.

### 3.2 Gmail Accounts
- Connect multiple Gmail accounts through Google's official OAuth 2.0 flow.
- Show account identity, granted scopes, connection state, and last successful API use.
- Reauthorize only when Google requires it.
- Disconnect an account and securely remove its stored credentials.

### 3.3 Mail Center
Planned capabilities, gated by the minimum required Google OAuth scopes:
- Inbox, Sent, Drafts, Spam, Trash, All Mail, Starred, Important, and Unread views.
- Search and open message conversations.
- Read message bodies and safely handle attachment metadata/downloads.
- Compose, reply, and forward.
- Archive, trash, mark read/unread, star, and apply labels.

**Permission rule:** the current Gmail connection is read-only. Write actions must not be enabled until the owner explicitly approves the required additional OAuth scopes, the consent/verification implications are reviewed, and the implementation is tested. Do not silently expand scopes.

### 3.4 Authentication Vault
- Store TOTP authenticator secrets for accounts where the owner has intentionally enrolled the Vault as an authenticator.
- Generate RFC 6238-compatible time-based 6-digit codes.
- Show the remaining validity period and allow safe copying.
- Store Google backup codes encrypted.
- Track backup-code use and remaining unused codes.
- Support secure replacement/rotation of stored factors.

TOTP setup requires the owner to enroll or transfer the authenticator secret through Google's supported setup process. The Vault cannot retrieve an existing secret from Google after the fact.

### 3.5 Emergency Recovery Center
- Guided lost-device workflow.
- Show which recovery factors are configured and usable.
- Provide access to stored TOTP and unused backup codes after Vault authentication.
- Explain when Google may require other verification or account recovery.
- Never claim that a recovery factor guarantees account access.

### 3.6 Security Settings
- Change Master Password.
- Manage Vault Recovery Code.
- Review sessions and sign out other sessions where supported.
- Review security/audit events.
- Manage connected Gmail accounts and stored recovery factors.

## 4. Security and trust boundaries

### Vault authentication
- Vault Login ID + Master Password are independent of Gmail credentials, phone number, and SIM.
- Recovery Code supports Vault account recovery under the documented recovery flow.
- If both Master Password and Recovery Code are lost, there is no hidden bypass.
- Use secure server-managed sessions, rate limiting, same-origin checks, and audit events.

### Gmail access
- Use Google's official OAuth 2.0 and Gmail API only.
- Never collect or store Gmail passwords.
- Keep OAuth client secrets and refresh tokens server-side.
- Encrypt stored refresh tokens with AES-256-GCM.
- Scope every privileged database operation to the authenticated Vault user.
- Google may revoke or expire grants or require reauthorization. The Vault cannot guarantee permanent Gmail API access.

### Authenticator and backup-code storage
- Treat TOTP seeds and backup codes as high-value secrets.
- Encrypt them at rest with a key hierarchy designed specifically for user-controlled Vault unlocking; do not store plaintext secrets in browser local storage, logs, analytics, or client-visible API responses.
- Unlock/decrypt only after successful Vault authentication and only for the current owner.
- Protect secret display and copy actions against accidental exposure; use short-lived reveal states and avoid logging values.
- Never send TOTP seeds or backup codes to third-party analytics or AI services.
- Plan for secure export/backup and key rotation before production use.

### Google verification boundary
- The Vault can generate a TOTP code from a previously enrolled secret and retrieve a previously saved, unused backup code.
- There is no supported general Gmail API that lets this app approve a Google Prompt on a user's behalf.
- The Vault cannot impersonate a trusted device, bypass OTP, defeat 2-Step Verification, reset a Google password, or override Google's account-recovery decisions.
- If Google requires a different factor or additional verification, the user must complete Google's supported process.

## 5. Technical architecture

- **Frontend:** existing Next.js application.
- **Vault identity/session:** existing Supabase Auth-backed independent Vault login and secure server-managed cookies.
- **Database:** existing Supabase project and private tables; no second Supabase project is planned.
- **Gmail integration:** official Google OAuth 2.0 and Gmail API.
- **Secrets:** server-side encrypted OAuth refresh tokens; a separately reviewed encryption/key-derivation design for TOTP seeds and backup codes.
- **Hosting:** existing Vercel project, using only the intended Vercel account.
- **Testing:** unit tests, route/security tests, CI typecheck/build, and end-to-end fresh-browser recovery tests.

Do not put secrets in GitHub, chat messages, client bundles, or public environment variables. Do not change production environment variables or run database migrations without explicit review and approval.

## 6. Delivery roadmap

### Phase 0 — Preserve and inspect
- Keep the existing Vault login, Recovery Code, Supabase schema, OAuth connection, encrypted refresh-token storage, and current feature-branch work.
- Inspect current implementation and CI/deployment status before making changes.
- Do not reset the repository or discard existing commits.

### Phase 1 — Authentication Vault foundation
- Design and threat-model TOTP secret enrollment, encryption, unlock, display, rotation, and deletion.
- Design encrypted Google backup-code storage and used-code tracking.
- Add per-account setup/readiness status.
- Add tests for encryption, authorization isolation, replay/use tracking, and secret non-disclosure.

### Phase 2 — Gmail Management
- Verify current read-only inbox, search, and message-detail behavior.
- Complete mailbox navigation and read-only experience.
- Review the exact OAuth scopes needed for write operations.
- Only after explicit owner approval, add the minimum write scopes and implement compose/send, reply/forward, archive, label, star, and read-state actions.
- Review Google OAuth consent and verification requirements before expanding scopes.

### Phase 3 — Emergency Recovery Center
- Build the guided replacement-device workflow.
- Make TOTP and unused backup codes quickly accessible after Vault login.
- Clearly show unsupported Google Prompt approval and other Google verification limits.

### Phase 4 — Security hardening
- Threat-model XSS, session theft, CSRF, database compromise, key loss, malicious browser extensions, and device compromise.
- Add session controls, audit coverage, secret reveal protections, backups, and recovery/key-rotation procedures.
- Verify no secret appears in logs, URLs, analytics, or client network responses beyond the intended one-time display.

### Phase 5 — Acceptance testing and release readiness
- Test in a fresh browser with no existing Google session and no access to the old phone/SIM.
- Verify Vault login works independently.
- Verify TOTP generation from the pre-enrolled secret and backup-code retrieval.
- Verify Gmail API access using the stored OAuth grant when still valid.
- Test revoked/expired OAuth grants and Google-required reauthorization.
- Test that Google Prompt approval is not falsely represented as supported.
- Do not merge to `main` or deploy production until the owner explicitly approves.

## 7. Definition of success

The project is successful when:

1. The owner can sign into the Vault on a replacement device using only the independent Vault credentials.
2. The owner can retrieve a valid TOTP code or an unused stored backup code for a previously configured Google account.
3. The owner can use Gmail Management features permitted by the account's explicitly granted OAuth scopes.
4. The app clearly distinguishes Gmail API access from Google's native account sign-in and recovery.
5. Secrets remain encrypted and isolated to the authenticated owner.
6. Fresh-device, lost-phone, revoked-token, and recovery edge cases are tested and documented.

## 8. Working rules

- Continue on `feature/vault-authentication` unless the owner explicitly changes the branch.
- Do not edit, merge, or deploy `main` without explicit approval.
- Do not delete existing work merely because the project direction has been clarified.
- Do not change Supabase schema or production settings without showing the proposed change and receiving approval.
- Do not request or expose passwords, OAuth client secrets, refresh tokens, encryption keys, or backup codes in chat.
- Explain progress in Burmese, one verified step at a time.
