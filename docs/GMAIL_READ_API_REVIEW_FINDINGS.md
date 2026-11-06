# Gmail Read API Review Findings

Date: 2026-11-06
Branch: `feature/vault-authentication`

## Scope reviewed

- `app/api/gmail/messages/route.ts`
- `app/api/gmail/connect/route.ts`
- `app/vault/gmail-inbox.tsx`
- `lib/gmail/token-encryption.ts`

Static review only. No live Google account, OAuth secret, production database, or real mailbox was accessed.

## Existing behavior confirmed

- Gmail connection initiation requires an authenticated Vault user.
- OAuth state is random, HMAC-bound to the Vault user, stored in a short-lived HttpOnly cookie, and checked in the callback.
- Requested Gmail permission is currently `gmail.readonly`.
- Gmail message listing is scoped to the authenticated Vault user and an active connection.
- Refresh tokens are decrypted only in the server-side route and exchanged for short-lived access tokens using Google's token endpoint.
- The inbox UI supports account selection, mailbox labels, search, listing up to 20 messages, and opening message details.
- Responses from the inbox list route use `Cache-Control: no-store, private`.

## Findings

### GR-01 — Gmail connection key version is not selected or passed to decrypt

The messages route selects ciphertext, IV, and authentication tag, but not `encryption_key_version`. The current `decryptRefreshToken` helper also accepts no key-version parameter and always uses the single configured `VAULT_ENCRYPTION_KEY`.

**Impact:** key rotation cannot safely be introduced with the current data path. This is related to GCB-01 in `GMAIL_CALLBACK_REVIEW_FINDINGS.md`; both the callback reuse path and Gmail API read path must be addressed together before rotating keys.

**Recommendation:** define a versioned keyring/envelope design first. Select the stored version, validate it, and decrypt with the matching configured key. Keep old keys available until all ciphertext has been safely re-encrypted and verified. Do not add a migration that silently assumes every record is version 1.

### GR-02 — Refresh-token failure status update result is ignored

When Google's refresh-token endpoint returns a non-success response, the route attempts to set `connection_status: reauthorization_required`, but discards the Supabase update result.

**Impact:** the API tells the user reauthorization is required even if the connection status could not be persisted. The UI may continue to display an outdated active state.

**Recommendation:** inspect the update result, log a structured server-side operational event without credentials, and return a response that distinguishes the Google authorization failure from a status-persistence failure. Add tests for both successful and failed status updates.

### GR-03 — Gmail list failure does not distinguish revoked consent from transient API failure

A Gmail list response with status 403 is returned as 403; other non-success responses become 502. The route does not currently inspect a bounded, sanitized Google error reason to determine whether the connection needs reauthorization or the request failed for another reason.

**Impact:** users may receive an unclear error and the connection status may remain active even when the granted permission is no longer sufficient.

**Recommendation:** map only documented Google error reasons to a reconnect state; treat transient failures separately. Never return raw Google response bodies or token material to the browser.

### GR-04 — Per-message metadata fetches are launched concurrently

The route fetches up to 20 individual message metadata records with `Promise.all`.

**Impact:** this is bounded to 20 calls per request, but can still create bursts and amplify transient Google API failures or quota pressure.

**Recommendation:** consider a small concurrency limit and partial-result handling. Keep the maximum message count bounded and test rate-limit/quota responses.

### GR-05 — OAuth connection uses a broad consent prompt every time

The connect route requests `prompt=select_account consent` on each initiated connection.

**Impact:** this can make repeated connections more interactive than necessary and may repeatedly show consent UI. Google still controls when consent or verification is required.

**Recommendation:** retain explicit account selection if it is a product requirement, but evaluate whether forcing `consent` every time is necessary. Do not remove it until refresh-token issuance and reconnect behavior have dedicated tests.

## Recommended next steps

1. Design the token key-version/keyring contract before any encryption-key rotation.
2. Add regression tests for connection-status persistence failure and Google refresh-token rejection.
3. Add bounded concurrency or a controlled batch strategy for metadata reads.
4. Verify OAuth prompt behavior against the intended multi-account UX.
5. Continue to keep Gmail scopes least-privilege. Do not add send/modify scopes until those features are explicitly designed and tested.

No production code was changed by this review. No merge or production deployment was performed.
