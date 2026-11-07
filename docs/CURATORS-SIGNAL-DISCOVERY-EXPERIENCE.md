# The Curator's Signal — Discovery Experience

**Status:** Approved implementation direction; staged implementation  
**Branch:** `design/cyber-visual-architecture`  
**Scope:** Public discovery experience and Secondary-account registration entry  
**Security classification:** UX discovery layer only; never an authentication or authorization control

## Product intent

The Curator's Signal is an elegant, ambient discovery ritual embedded in the ordinary public vault experience. It rewards observation and culminates in a tactile Fourfold Vault artifact. It must not make the product feel like a terminal-themed game or imply that fictional visuals are live security telemetry.

The experience should feel like discovering the craftsmanship of a hidden archive: restrained, forensic, quiet, tactile, and memorable.

## Non-negotiable trust boundaries

1. Puzzle completion is not authentication.
2. Puzzle completion is not authorization to read or modify vault data.
3. Puzzle completion may produce only a short-lived, one-time, session-bound claim to attempt Secondary registration.
4. The registration service independently validates and consumes that claim atomically, then creates only the Secondary role. It ignores client-supplied role, privilege, owner, or tier fields.
5. No public endpoint may create, promote, recover, or impersonate a Master/Owner identity.
6. Master/Owner identity is provisioned out-of-band and uses a separate authentication and MFA trust boundary.
7. Every Research Lab route and API independently verifies Owner authorization and recent MFA server-side.
8. Secondary accounts may manage only their own records. Their vault limit is four credential records, enforced transactionally by the database/server. The number of Secondary accounts is not capped by this four-record limit.
9. Puzzle input must never include actual passwords, recovery codes, notes, or other credential values. Do not inspect keystrokes or log form values. Before a valid registration claim exists, keep Create form values in browser memory and do not transmit them.
10. Puzzle state, answer validation, expiry, attempt budgets, and claim consumption are server-authoritative. Client state is presentation only.

## Experience structure

### Stage 0 — The Whisper

Any Create attempt without a valid registration claim opens the discovery invitation. Do not attempt to infer whether typed values are "real". Never send those values to the server as part of puzzle initiation. The user may dismiss the experience and return later.

The invitation copy should be calm and inviting, not accusatory. A subtle archive seam and a restrained out-of-pattern ambient pulse are enough. The interface must not imply that the pulse represents real telemetry.

### Stage 1 — The Archive Marks

Three independent clue families can be explored in any order:

- **The Margin:** a visual anomaly in a chart/grid edge.
- **The Empty Shelf:** an empty-state detail that points toward the four archive record categories.
- **The Curator's Note:** a small typographic or timestamp anomaly in a static editorial surface.

Each discovered mark reveals one fragment. Clues must not block ordinary navigation or obscure controls. Avoid color-only, hover-only, and sound-only clues.

### Stage 2 — The Forgotten Order

The user interprets the fragments to establish a four-part symbolic sequence. Puzzle symbols refer to abstract archive categories only; they never read or use the user's actual vault contents. Puzzle variants may shuffle the symbols and clue positions per session while preserving the same logical difficulty.

### Stage 3 — The Fourfold Lock

A four-ring artifact is the tactile finale. Users rotate rings with touch, click, or keyboard controls. Large arrow controls are available as an alternative to dragging. The interface announces state changes to assistive technology. A non-visual equivalent is required before public release.

### Stage 4 — The Revelation

Only after the server validates the final sequence does it create a scoped PuzzleCompletion and issue a short-lived, single-use RegistrationClaim bound to the active challenge and session. The transition reveals the Secondary Create Access panel. The claim does not grant a vault session, access to existing data, or Owner privileges.

### Stage 5 — Ordinary Secondary registration

The user completes the ordinary registration flow. The server consumes the claim atomically, verifies required email/account confirmation, creates only a Secondary identity, and rotates the session. Registration must not accept a client-selected role.

## Difficulty and fairness

- Target engaged completion time: approximately 8–15 minutes.
- No countdown, public leaderboard, punitive failure, or permanent lockout.
- Progress resumes after refresh using server-side challenge state.
- Hints progress from gentle nudge to explicit next-step guidance.
- Users may dismiss and resume the challenge.
- Provide an accessible alternative path and a human-reviewed access-request fallback; neither path grants Owner access.
- Session-specific clue variants are recommended to reduce answer-sharing value, but the narrative and logical structure remain stable.

## Motion and visual direction

- Palette: deep teal, blue-black, muted silver, restrained antique gold.
- The ambient dashboard remains calm; clues are subtle details, not flashing alerts.
- Final reveal: approximately 2–3 seconds, skippable.
- Respect reduced-motion preferences with a simple crossfade/static reveal.
- Sound and haptics are optional and off by default.
- No rapid flashing, focus traps, or motion required to solve.

## Abuse controls

- One active challenge per session.
- Server-side state transitions and attempt accounting.
- Session-bound, short-lived, single-use registration claim, consumed atomically.
- Rate limits by session and risk signals; risk-based CAPTCHA only when warranted.
- Email verification and generic account-existence responses.
- No passwords, backup codes, notes, or raw registration payloads in puzzle logs.
- Do not treat puzzle completion as bot-proofing.

## Implementation sequence and release gates

1. **Design and presentation:** define the story, clue surfaces, responsive artifact, motion, hints, and accessibility.
2. **Server authority:** add challenge persistence, server-side stage validation, session binding, expiry, attempt controls, and one-time claim issuance.
3. **Registration boundary:** require and consume the claim; hardcode Secondary role server-side; prohibit public Owner creation or promotion.
4. **Account isolation and quotas:** enforce per-user ownership and the four-record Secondary limit transactionally.
5. **Owner boundary:** verify separate Owner identity, recent MFA, and server-side authorization on every Research Lab route/API.
6. **Verification:** unit/integration tests for replay, expiry, session binding, claim reuse, role mass assignment, cross-user access, quota races, and secret non-disclosure.
7. **Release:** preview only after the user explicitly asks; production deployment requires separate explicit approval.

## Current implementation truth

This document defines the approved direction. A visual prototype or client-side interaction is not evidence that server-side challenge validation, registration claims, account roles, quotas, or Owner authorization are implemented. Each phase must be reported separately as planned, implemented, tested, or independently verified. Do not store real high-value credentials or claim production readiness until the security foundation and release gates have passed.
