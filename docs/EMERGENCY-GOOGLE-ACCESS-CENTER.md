# Emergency Google Access Center — Product & Recovery Design

**Project:** Private Gmail Vault  
**Target branch:** `feature/vault-authentication`  
**Status:** Approved product direction; design documentation only.  
**Last updated:** 2026-11-06

## 1. Purpose

The Emergency Google Access Center is intended to help the owner recover access to a Google account after losing their phone and SIM, using a new device and the Private Gmail Vault web app as a secure control center.

The goal is not to bypass Google sign-in checks or impersonate a trusted device. The app should organize and guide the owner through Google-supported verification and account-recovery methods, then restore the Vault's Gmail connection when Google authorization is available again.

## 2. Target emergency scenario

1. The owner loses their old phone and SIM.
2. The owner obtains a new device and opens the Private Gmail Vault website.
3. The owner authenticates to the Vault without relying solely on the lost phone or SIM.
4. The owner selects the affected Gmail account in **Emergency Access Center**.
5. Google asks for additional verification during sign-in.
6. The Vault explains the available recovery options and opens the relevant official Google flow or presents the owner's previously stored recovery guidance/material.
7. The owner completes the challenge directly with Google, using a method Google actually offers for that account.
8. Once Google sign-in is restored, the owner secures the account, removes the lost device/session where appropriate, and updates recovery methods.
9. The Vault checks its own OAuth grant and reconnects through Google's official OAuth consent flow if needed.

## 3. Critical separation of authentication systems

There are three separate security layers. They must not be represented as interchangeable.

### A. Vault authentication

Controls access to Private Gmail Vault itself. It needs an emergency-access strategy that does not depend exclusively on the lost phone or SIM.

Potential controls:
- Strong master-password authentication.
- Independent MFA options, such as a separately stored hardware security key or passkey on another device.
- One-time Vault recovery codes, stored offline and hashed at rest where applicable.
- Rate limiting, session revocation, audit events, and alerts.
- A documented recovery process that does not expose Gmail tokens or recovery secrets.

Vault recovery does **not** restore a Google account or recreate a revoked Google OAuth grant.

### B. Google account sign-in verification and recovery

Google alone decides which challenges and recovery methods are available for a given account and sign-in attempt. The Vault may:
- Open official Google sign-in, account recovery, and security pages.
- Guide the owner through Google's displayed options, such as a backup code, passkey, security key, recovery email, another already trusted device, or Google's account-recovery process, when Google offers them.
- Provide access to recovery material the owner deliberately stored in the Vault, subject to strong Vault authentication and careful secret handling.
- Record the owner's recovery checklist and the status of their preparedness.

The Vault must not:
- Claim it can approve a Google Prompt or device sign-in challenge on Google's behalf.
- Generate, intercept, replay, or fabricate Google verification codes.
- Bypass CAPTCHA, risk checks, 2-Step Verification, device trust, or Google's recovery decisions.
- Automate entry into Google sign-in pages or scrape Google security challenges.
- Promise that every account can be recovered if all trusted factors and recovery methods are lost.

A Google backup code is generally single-use. The app must warn the owner to mark a code as consumed and refresh the stored recovery set after use. Do not silently reuse or expose codes in logs, analytics, URLs, or support output.

### C. Gmail OAuth authorization for the Vault

The Vault's Gmail connection is separate from signing in to Gmail in a browser.

- A still-valid OAuth grant and refresh token may continue working even if the owner signs in on a new device.
- A Google account sign-in challenge on a new device does not automatically mean the Vault's OAuth grant is invalid.
- If the grant is revoked, expired, invalidated, or otherwise requires renewed consent, the Vault must start the official Google OAuth authorization flow.
- The callback must validate state, bind the Google identity to the authenticated Vault user, and securely encrypt any refresh token.
- The Vault must never promise permanent authorization or that Google will never request reauthentication.

## 4. Proposed user experience

### Emergency Access Center

Show one row/card per connected Google account with:
- Account identifier (masked where practical).
- Vault connection state: Connected, Reauthorization required, or Connection check failed.
- Last successful connection check.
- A clear **Start Google Recovery** action.
- A separate **Reconnect Gmail to Vault** action when OAuth consent is needed.

### Start Google Recovery

1. Require a fresh Vault authentication step before revealing recovery material.
2. Show a short warning that Google controls the available verification methods.
3. Offer official Google destinations and a step-by-step checklist.
4. Show only recovery methods that the owner has configured or that Google confirms are available; do not infer that a method will be offered.
5. Keep the owner in control of entering codes and completing challenges on Google's official page.
6. After the owner reports completion, provide a **Check Gmail Connection** action. Do not claim Google verification succeeded merely because the owner clicked a button.

### Reconnect Gmail to Vault

1. Check the existing OAuth connection.
2. If the access token can be refreshed, refresh it securely and test the permitted Gmail API operation.
3. If Google returns an authorization error requiring consent, explain why and start the official OAuth flow.
4. Request only the scopes the owner has approved. The current implementation uses `gmail.readonly`; do not silently add send/modify scopes.
5. After callback, verify identity and persist encrypted token material using the configured encryption versioning scheme.

## 5. Recovery preparedness checklist

Before an emergency, the owner should configure and independently store:
- A recovery email that is accessible without the lost SIM.
- Google backup codes, if enabled, in a secure offline location and optionally encrypted in the Vault.
- A passkey or hardware security key that is not kept only with the primary phone.
- More than one viable sign-in/recovery factor where Google permits it.
- Vault recovery codes stored separately from the device and from the Vault's only copy.
- A current inventory of trusted devices and recovery methods.

Do not store all recovery factors solely inside the Vault. If Vault access and the phone are both lost, a single-location recovery design creates a circular dependency.

## 6. Security and privacy requirements

- Encrypt stored Google recovery material with a separately reviewed design; do not reuse OAuth token ciphertext fields for unrelated secrets without explicit schema and cryptographic review.
- Never log passwords, OTPs, backup codes, OAuth access tokens, refresh tokens, client secrets, or encryption keys.
- Require reauthentication before displaying or copying sensitive recovery material.
- Use short-lived, revocable Vault sessions and record security-relevant events without recording secret values.
- Protect against CSRF, XSS, session fixation, account enumeration, and unauthorized account switching.
- Clearly identify official Google domains before redirecting.
- Do not embed Google sign-in pages in an iframe or proxy Google's authentication pages.
- Make recovery guidance usable on a phone-sized screen.

## 7. Important product limitations

- Google may require a trusted device, security key, passkey, recovery email, backup code, or a manual account-recovery review. The options are account- and risk-dependent.
- The Vault cannot force Google to offer a particular method.
- If the owner has lost every trusted factor and cannot satisfy Google's recovery process, the Vault cannot guarantee recovery.
- The Vault's saved recovery material is useful only if the owner can securely access the Vault and Google accepts that method for the current challenge.
- Signing into Gmail on a new device and reauthorizing the Vault's Gmail API access are different operations.

## 8. Current implementation boundary

At the time of this document:
- The project is on `feature/vault-authentication`.
- Gmail OAuth integration currently uses the `gmail.readonly` scope.
- Token encryption supports versioned keys and format-aware authenticated encryption, with migration 004 committed but **not applied** to the live database.
- The encryption and OAuth state key environment variables have design/documentation placeholders only; no live secret provisioning is included in this work.
- The migration, live database, Google account, production environment, and production deployment must not be changed as part of this documentation task.
- The current branch must not be merged into `main`, and production must not be deployed without separate explicit approval.

## 9. Phased implementation plan

### Phase 1 — Recovery readiness design
- Inventory current Vault authentication and recovery behavior.
- Define independent Vault emergency access and recovery-code lifecycle.
- Define data classification and encryption design for any Google backup codes or recovery notes.
- Add UI states and official Google destination allowlist.

### Phase 2 — Emergency Access Center (guidance only)
- Build the responsive account dashboard and recovery checklist.
- Add secure reveal/copy controls for owner-provided recovery material only after fresh authentication.
- Add clear warnings and links to official Google recovery/security pages.
- Add audit events that never contain secret values.

### Phase 3 — OAuth connection health and reconnection
- Distinguish Google browser sign-in challenges from Gmail OAuth grant failures.
- Improve OAuth error classification and connection-health checks.
- Provide an explicit, secure reconnect flow when consent is actually required.
- Preserve least-privilege scopes and token encryption/versioning.

### Phase 4 — Verification and recovery testing
- Unit-test recovery-code handling, redaction, access controls, and state transitions.
- Test OAuth reconnect using a dedicated test Google account.
- Test the lost-phone/lost-SIM scenario without using production credentials.
- Review threat model and recovery dead ends before enabling real recovery-material storage.

## 10. Acceptance criteria

The feature is ready for release only when:
- The owner can access the Vault on a new device without relying solely on the lost phone/SIM.
- The UI clearly separates Vault recovery, Google account recovery, and Gmail OAuth reconnection.
- All Google verification is completed through Google-supported flows.
- The app never claims to approve or bypass Google's device challenges.
- Sensitive recovery material is encrypted, access-controlled, redacted from logs, and backed up independently.
- Gmail OAuth connection status is verified by an actual permitted API check, not by a UI assertion.
- The owner is told when recovery is not possible through the available methods.
- Tests and a security review pass before production rollout.

---

**Product principle:** One secure Vault control center for preparedness, guided Google recovery, and Gmail reconnection — while Google remains the authority for Google account verification.
