# Supabase Auth Password Update Audit

**Status:** Documentation only. No runtime code, SQL, Supabase data, merge, or deployment changed.
**Branch:** feature/vault-authentication
**Date:** 2026-11-06

## Findings

1. package.json declares @supabase/supabase-js as ^2.57.4 and @supabase/ssr as ^0.7.0.
2. No package-lock.json, pnpm-lock.yaml, or yarn.lock was found at the repository root. The exact resolved package version is therefore not established by committed files.
3. The legacy recovery endpoint is app/api/auth/recovery/route.ts.
4. It calls admin.auth.admin.updateUserById(userId, { password }) through the server-only admin client in lib/supabase/admin.ts.
5. The legacy route updates the Auth password before generating and persisting the replacement Recovery Code. If the later database finish step fails, it returns a pending-recovery message and its finally block releases the legacy claim when recoveryFinished is false.
6. This legacy flow is not a safe implementation template for Authenticator Recovery. The proposed flow must persist pending wrappers and operation state before changing the Auth password, then reconcile using a verified new-password session for the same Vault user.

## Version and provider behavior

The caret range in package.json does not identify the exact installed Supabase JS version. Without a committed lockfile or a build artifact that records the resolved version, same-password retry semantics cannot be asserted.

Before implementation:
- Pin and record the exact resolved dependency version in an approved dependency-management change.
- Use a disposable Supabase project and disposable test user.
- Test successful password update, same-password retry, lost response after provider success, request loss before provider processing, and sign-in with old versus new password.
- Never run these tests against the user's active project, real Vault account, or connected Gmail account.

## Required failure-injection tests

| ID | Scenario | Required behavior |
|---|---|---|
| F01 | Claim commits but response is lost | Same operation retry returns the same operation; no duplicate claim |
| F02 | Operation ID reused with different claim secret | Reject without changing the operation |
| F03 | Concurrent claims for one user/version | Only one non-terminal operation wins |
| F04 | Browser reload before Auth update | Abandon safely; active wrappers and Recovery Code remain unchanged |
| F05 | Wrapper-stage response is lost | Same payload retry is idempotent; changed payload is rejected |
| F06 | Provider rejects update before changing password | Active generation remains unchanged |
| F07 | Provider changes password but response is lost | Keep operation in progress and retain pending wrappers |
| F08 | Server crashes after provider success | New-password sign-in for same user can reconcile |
| F09 | Old password still works after ambiguous response | Do not infer success or blindly retry |
| F10 | New password works and old password fails | Verified same-user session may resume reconciliation |
| F11 | Finalization commits but response is lost | Retry returns finalized result; version increments once |
| F12 | Concurrent finalization | One atomic promotion; no double increment |
| F13 | Replacement-code response is lost | Return same encrypted retry copy while valid |
| F14 | Retry copy expires before Auth update | Safe abandon only while Auth update is definitely not started |
| F15 | Retry copy expires after Auth update may have started | Preserve operation for authenticated reconciliation |
| F16 | Different Vault user attempts reconciliation | Reject; no cross-user disclosure or promotion |
| F17 | Pending wrapper payload is incomplete | Do not finalize |
| F18 | Cleanup runs during unresolved in-progress state | Do not delete operation or pending wrappers by ordinary lease expiry |

## Implementation gates

Do not implement Authenticator Recovery runtime routes or executable SQL until:
- Exact resolved Supabase dependency version is pinned and recorded.
- Provider same-password retry and lost-response behavior is tested in a disposable project.
- Pending wrappers and replacement Recovery Code are persisted before Auth update.
- An unresolved in-progress operation cannot be removed by ordinary lease expiry.
- New-password session is verified server-side and bound to the same Vault user.
- Finalization is atomic and idempotent.
- Failure-injection tests F01-F18 pass.
- SQL grants, RLS, function ownership, fixed search_path, row locks, and cleanup policy are reviewed.

## Scope boundary

This audit records observed repository behavior and a test plan only. It does not change runtime code, migrations, Supabase data, Gmail OAuth behavior, Main, pull-request merge state, or Vercel Production.
