# Cyber Visual Architecture — Design System v1

**Status:** Initial design foundation  
**Branch:** `design/cyber-visual-architecture`  
**Scope:** Visual architecture, motion behavior, truthful data presentation, and publication design. This phase does not alter authentication, encryption, APIs, database schemas, or production configuration.

## Design thesis

Build a professional cybersecurity research platform where visual craft supports comprehension. The interface should feel precise, calm, responsive, and alive without implying events that did not happen.

## Five visual layers

1. **Atmosphere** — deep graphite/navy surfaces, restrained teal/emerald light, fine grid texture, and deliberate negative space.
2. **Information** — clear hierarchy, readable labels, aligned numeric values, and explicit units/time ranges.
3. **Interaction** — short transitions for focus, hover, tabs, dialogs, forms, loading, success, and errors.
4. **Evidence** — event timelines, findings, metrics, and research artifacts only from traceable sources.
5. **Accessibility** — keyboard-visible focus, reduced-motion support, sufficient contrast, and mobile-first responsive behavior.

## Motion rules

- Use motion to communicate a real interface state change: opening a record, switching a tab, saving, filtering, revealing a field, or receiving a response.
- Use ambient motion sparingly for non-informational decoration only.
- Do not animate a metric, event counter, attack path, packet, log line, or status unless a real underlying value/event changed.
- Never fabricate scan activity, network traffic, intrusion attempts, success states, or live telemetry for visual effect.
- Keep transitions short and purposeful; avoid continuous movement on controls and reading surfaces.
- Respect `prefers-reduced-motion`; content and functionality must remain complete without animation.

## Data truth contract

Every data visualization must identify:
- source or collection mechanism;
- whether data is live, delayed, sampled, replayed, or static;
- observation time and time zone where relevant;
- units, aggregation window, and missing-data behavior;
- test environment and scope for security test results.

When no real data is available, show an explicit empty/unavailable state. Demonstration fixtures must be labeled **SIMULATED / DEMO DATA** and visually separated from production telemetry. Decorative effects must never resemble telemetry.

## Interaction grammar

| Interaction | Motion behavior |
|---|---|
| Page entry | One restrained fade/vertical settle; no perpetual page movement |
| Card hover/focus | Small lift and border emphasis; keyboard focus remains visible |
| Tab/mode change | Content crossfade/settle; preserve focus and entered values where appropriate |
| Dialog/detail viewer | Backdrop fade + short content rise; maintain native dialog semantics |
| Save/delete | Animate only after the server confirms the outcome |
| Loading | Indeterminate indicator clearly labeled as loading; never imply progress percentage |
| Error/success | Brief entrance and persistent readable message; no color-only communication |
| Live data update | Animate the changed datum only, tied to the received event; expose timestamp/source |

## Current implementation notes

- `app/motion-system.css` contains shared timing tokens, restrained entry/interaction transitions, and reduced-motion handling.
- Existing Vault record cards, forms, feedback, and inspector receive state/interaction transitions.
- Existing public Security modules and evidence surfaces receive restrained interaction feedback.
- The authentication flow retains its existing API behavior. This phase changes presentation only.
- No new telemetry source or fabricated data stream is introduced.

## Public UI/UX engineering documentation

The public engineering notes are available at `/security/architecture`. The page documents the source-observed stack, design philosophy, shared visual tokens, motion timings, responsive breakpoints, accessibility techniques, implementation references, and outstanding verification work.

Documentation rules:
- Report framework and library versions from the package manifest, not assumptions.
- Link design claims to their implementation files.
- Distinguish **IMPLEMENTED**, **TESTED**, **VERIFIED**, **PLANNED**, and **NOT VERIFIED**.
- Treat source inspection as source review only; do not describe it as browser QA, accessibility certification, performance profiling, or security audit.
- Keep public examples free of credentials, private identifiers, secrets, and exploit-enabling material.
- Update the public page when tokens, architecture, implementation status, or verification evidence changes.

Current public documentation is an initial source-based edition. Cross-device visual QA, a full accessibility audit, and measured performance profiling remain outstanding.

Source-review refinements:
- The public page now shows the actual font stacks, easing, focus-ring, radius, and color tokens declared in the shared stylesheet.
- Package versions distinguish the exact Next.js pin from the React and TypeScript semver ranges in `package.json`.
- Responsive rules are documented by their actual CSS breakpoints and affected surfaces (900, 760, 680, 640, 560, 480, and 420 CSS pixels).
- Opaque palette sample contrast ratios against `#070f19` were calculated using WCAG relative-luminance math: primary text `#eafff9` = 18.48:1; muted text `#9ab6bf` = 9.00:1; teal `#76e3c3` = 12.41:1. These are color-pair calculations only, not a rendered-component audit or conformance claim.
- The public page defines a planned QA protocol for viewport sweeps, keyboard-only navigation, reduced motion, assistive technology, rendered contrast, and performance traces. No browser-run results are claimed yet.
- Source-level semantics: the conceptual architecture illustration is exposed with an image role and descriptive accessible name; the decorative notice glyph is hidden from assistive technology. This is not a screen-reader test result.


## Roadmap

### Phase A — shared motion foundation
- [x] Define timing/easing tokens and reduced-motion behavior.
- [x] Add restrained entry transitions for Login, Security, and Vault surfaces.
- [x] Add interaction transitions to existing Vault and Security UI elements.
- [ ] Browser-level visual verification on mobile and desktop.

### Phase B — dashboard composition
- [ ] Establish a consistent operations shell, navigation, status language, and responsive grid.
- [x] Distinguish live telemetry, historical evidence, test fixtures, and decorative visuals in the public Security Operations page.
- [x] Add source-verified timestamps and commit provenance to the published historical CI evidence cards.
- [x] Align public dashboard section numbering and keep local tools clearly separate from system telemetry.
- [ ] Build accessible event and metric transitions driven by actual data changes.

### Phase C — research publication experience
- [x] Establish a responsive research-paper reading surface with abstract, provenance, structured sections, and references.
- [x] Add a bilingual edition switch with a restrained transition tied to the user's actual language selection.
- [ ] Verify every publication contains complete scope, methodology, findings, remediation, retest, limitations, and references.
- [ ] Architecture diagrams with source-backed legends and safe public disclosure.
- [ ] Draft → technical review → sensitive-data review → owner approval → publish workflow.

### Phase D — system-wide refinement
- [x] Refine research publication cards, empty state, provenance strip, and mobile reading layout.
- [ ] System-wide typography, spacing, iconography, empty/loading/error states, and responsive QA.
- [x] Add a credential-free, fictional, read-only Vault UI preview route without creating an auth session or calling Vault APIs.
- [ ] Performance and reduced-motion QA.
- [x] Publish source-based UI/UX engineering notes with stack, design tokens, motion, responsive rules, accessibility techniques, source links, and explicit verification status.\n- [ ] Add browser-based visual, accessibility, and performance evidence to the public engineering notes.

## Release boundary

All work remains on the design branch until reviewed. No merge to `main`, production deploy, production secret change, or production database migration is implied by this design work.


### Cross-surface consistency review — 2026-11-08

Source inspection found that the authenticated Vault is not yet using the same palette as Login and the public Security surfaces:
- Login and Security use the midnight/navy + teal/mint visual language defined in `app/security-experience.css` and `app/entry-experience.css`.
- The authenticated Vault's `.museum-shell` in `app/globals.css` still uses warm charcoal/green, parchment-like text, and antique-gold accents.
- The shared motion stylesheet covers all three surfaces, but shared motion does not make their color, typography, or component tokens identical.

The public UI/UX architecture page has been corrected to describe this as two current visual languages. It no longer claims the entire product already shares one palette. The token table and calculated contrast samples apply to the public entry/Security palette only. Vault palette convergence is a planned design task, not an implemented change.

Review boundary: this was a source-level comparison of the checked-in CSS and page composition. No browser rendering, viewport screenshot comparison, automated build, accessibility audit, or performance trace was run in this review.



### Vault visual alignment pass — 2026-11-08

Implemented a scoped palette bridge at the end of `app/globals.css` for the authenticated `.museum-shell` surface:
- Main Vault background, ambient grid, header, supporting text, collection controls, forms, record cards, feedback, and footer now use the midnight/navy + teal/mint family already used by Login and public Security.
- Interactive controls use the shared teal focus outline and halo treatment.
- The museum identity is intentionally retained through its editorial layout, emblem/artwork geometry, and restrained warm-metal details inside decorative artwork rather than applying a flat global recolor.
- Existing Vault data operations and authentication code were not changed by this CSS-only pass.

The public UI/UX engineering page now describes this as an implemented visual alignment pass. This is a source-level implementation record only: no browser screenshots, build, cross-device visual check, keyboard walkthrough, screen-reader audit, or performance profile has been run for this commit. Check mobile layout and all dialogs/inspector states in browser QA before calling the theme verified.


### Vault interaction accessibility refinement — 2026-11-08

Source-reviewed the authenticated Vault collection interactions in `app/vault/vault-manager.tsx` and implemented a focused keyboard-flow improvement:
- When Add Account or Edit Record opens the shared form, focus moves to the first Account name field.
- When that form closes, focus returns to the persistent Add account toolbar control.
- The form now has an explicit accessible name through `aria-labelledby`.
- Existing native `<dialog>` inspector behavior, concealed-by-default sensitive values, explicit reveal controls, clipboard actions, and two-step delete confirmation remain unchanged.
- No API request shape, authentication, encryption, persistence, or record data behavior was changed in this interaction-only refinement.

Status: **IMPLEMENTED IN SOURCE**. This has not yet been verified in a running browser or with keyboard-only/screen-reader testing. The public QA protocol remains **PLANNED · NOT RUN** until those checks are performed.


### Inspector and mobile dialog refinement — 2026-11-08

A second source-only interaction pass extends the Vault keyboard flow:
- The native record inspector places initial focus on its explicit Close record control when opened.
- Opening the delete confirmation moves focus to **Keep record** first, reducing the risk of accidental destructive confirmation through keyboard activation.
- Cancelling the confirmation restores focus to **Delete record**.
- The inspector uses dynamic viewport height where supported, with the existing `vh` fallback, and contains overscroll within the dialog on touch devices.
- Delete still requires an explicit second action on **Confirm delete**. The data/API behavior is unchanged.

Status: **IMPLEMENTED IN SOURCE; NOT BROWSER-VERIFIED**. Native dialog focus restoration, mobile viewport behavior, touch scrolling, and screen-reader announcements still require runtime QA.


### Vault sensitive-field and clipboard feedback pass — 2026-11-08

A source-only review of app/vault/vault-manager.tsx confirmed:
- Username, password, and backup-code values are concealed by default in the record inspector.
- Changing the active record resets all three reveal states; closing the inspector clears the active record and therefore returns the next opening to the concealed state.
- Reveal controls now expose their current on/off state through aria-pressed.
- Clipboard success feedback contains only the field label (for example, “Password copied to clipboard”), never the copied secret. A new copy attempt clears stale feedback first; failure asks the user to copy the currently revealed value manually.
- The application cannot clear or control the operating-system clipboard after a successful copy. Users should treat copied credentials as remaining available to other apps with clipboard access until the OS or user replaces/clears them.
- No API, authentication, encryption, persistence, or database behavior was changed in this UI/accessibility pass.

Status: IMPLEMENTED IN SOURCE; NOT RUNTIME-VERIFIED. Browser checks are still required for reveal state announcements, clipboard permission success/failure, mobile behavior, and focus/announcement quality with assistive technology. No claim is made that clipboard contents are automatically cleared.


### Sensitive data lifecycle review — 2026-11-08

Reviewed the Vault UI and current collection API without changing backend behavior.

Observed lifecycle:
- The Add/Edit form uses controlled React state. closeForm() resets the form object; successful saves also close and clear it. A failed save intentionally retains entered values for correction/retry.
- Opening a record resets the username, password, and backup-code reveal flags. Closing the inspector clears the active record selection and resets reveal flags.
- The collection API currently decrypts every authorized user's record server-side and returns plaintext account fields in the JSON response. The mounted Vault client retains the returned records in its items React state. Closing an individual inspector does not clear that collection cache.
- Therefore, masking and closing controls reduce on-screen exposure but do not guarantee erasure from JavaScript memory, browser process memory, developer tools, extensions, or operating-system clipboard.
- The current design is server-mediated encryption, NOT zero-knowledge. The browser receives plaintext record values after authentication.
- The application does not automatically clear clipboard contents after copying.

No backend, API, authentication, encryption, database, or production configuration was changed. A safer per-record fetch/data-minimization design and a browser-side key lifecycle would require a separately approved architecture/security change; it must not be represented as completed work.

Status: SOURCE-REVIEWED LIMITATION; REDESIGN PLANNED; NOT IMPLEMENTED OR VERIFIED. Runtime memory inspection, browser cache behavior, clipboard permissions, and assistive-technology checks remain outstanding.


### Proposed Vault data-minimization and client-key architecture — 2026-11-08

**Status: DESIGN PROPOSAL ONLY — NOT APPROVED FOR IMPLEMENTATION**

This proposal follows the source review of the current collection API and Vault client. It does not change the existing API, database, authentication flow, encryption behavior, or production configuration.

#### Confirmed current data flow

1. The authenticated collection request `GET /api/vault/items` selects every row belonging to the authenticated user.
2. The server decrypts every selected row and returns account name, username, password, and backup codes in one JSON response.
3. The mounted Vault client stores the complete returned collection in React state.
4. The per-record API route currently supports update and delete; it does not provide a per-record GET endpoint.
5. The current server-mediated encryption model is not zero-knowledge. The server has the ability to decrypt stored records.

#### Proposed security target

The target architecture should ensure that the server stores and serves ciphertext but never receives the Vault data-encryption key and never decrypts account content. The browser should decrypt only what is required for the current interaction.

A possible high-level flow:

- **Unlock:** Authenticate the user, then derive a key-encryption key from a Vault secret using a separately reviewed Argon2id implementation and parameters. The derivation adapter, password policy, rate limiting, recovery, and memory-handling rules must be reviewed before implementation.
- **Key envelope:** Use the existing client-side key-envelope module only after its integration and independent tests are reviewed. The envelope binds the wrapped random data-encryption key to the Vault identifier through authenticated additional data.
- **Collection:** Return record identifiers, timestamps, and encrypted metadata envelopes only. Do not return plaintext account names, usernames, passwords, or backup codes from the collection endpoint.
- **Local metadata view:** Decrypt metadata in the browser to render names and support search/sort. This means metadata plaintext still exists in browser memory while the collection is in use; the design must not claim otherwise.
- **Record detail:** Fetch the selected record's encrypted secret payload only when the user opens it. Decrypt locally for the active inspector. On close, discard references and reset UI state, while documenting that JavaScript garbage collection does not guarantee secure memory erasure.
- **Mutations:** Encrypt content in the browser before sending it to the API. The server validates envelope shape, size, ownership, and request origin, then stores ciphertext without decrypting it.
- **Cache and observability:** Keep sensitive responses non-cacheable. Never log plaintext, keys, envelopes, or request bodies. Public telemetry must contain no account identifiers or secret-bearing payloads.

#### Metadata privacy decision

A collection needs enough information to show useful record labels. Returning account names or usernames in plaintext would leak metadata to the server and database. The preferred direction is therefore encrypted metadata envelopes that the browser decrypts locally. The collection endpoint may return all metadata ciphertexts, but it must not return secret payload ciphertexts until a record is opened.

This is a deliberate compromise: it reduces secret exposure and server knowledge, but does not eliminate browser-memory exposure for decrypted collection labels. Search and sorting happen locally after metadata decryption.

#### Required security controls before implementation

- A reviewed Argon2id adapter with documented parameters, input normalization, versioning, and test vectors.
- Non-extractable browser CryptoKeys where supported; no raw key persistence in localStorage, sessionStorage, IndexedDB, URLs, logs, or analytics.
- Explicit key lifecycle for unlock, lock, tab close, session expiry, failed unlock, and account switching.
- Authenticated ownership checks on every read and write; cross-user and cross-Vault identifier substitution tests.
- Strict schema/size validation, same-origin protections for mutations, and no-store response headers.
- Authenticated additional data binding ciphertext to Vault ID, record ID, field purpose, and format version.
- Cryptographic test vectors, tamper tests, wrong-key tests, IV uniqueness strategy, malformed-envelope tests, and browser compatibility tests.
- Recovery and device-change design reviewed before claiming users can recover data. Loss of the only decryption key must not silently become server-side plaintext recovery.
- Threat model covering XSS, malicious browser extensions, compromised devices, server compromise, backups, logs, and clipboard exposure. Client-side encryption does not protect secrets while an attacker controls the unlocked browser.
- Independent security review before production use.

#### Legacy data migration — separate approval required

Existing rows use server-side encryption. They cannot simply be relabeled as client-encrypted data. A migration would require an explicit, tested conversion flow that:
1. Reads one legacy record through the existing authenticated path.
2. Encrypts it in the user's browser under the newly unlocked client-side data key.
3. Writes the new versioned ciphertext and envelope.
4. Verifies the new ciphertext can be decrypted locally before marking that record migrated.
5. Preserves a carefully controlled rollback/recovery strategy without leaving duplicate plaintext or weakening access controls.

The migration must define partial-failure behavior, backup handling, version negotiation, concurrent edits, account recovery, and deletion of legacy ciphertext. Do not run a migration or alter the current schema until the owner approves a detailed plan and test environment.

#### Acceptance tests required before any release claim

- Collection response contains no plaintext account name, username, password, or backup code and no secret-payload ciphertext.
- Collection response is scoped to the authenticated user and cannot enumerate another user's records.
- Opening one record fetches only that record's secret envelope.
- Changing record IDs cannot cross Vault ownership boundaries.
- Browser-side decrypt fails for wrong keys, modified ciphertext, modified AAD, wrong Vault IDs, and wrong record IDs.
- No secret values appear in logs, URLs, analytics, error messages, or browser persistence.
- Lock, sign-out, session expiry, and account switching clear application references and return the UI to a concealed state.
- Cache headers remain non-cacheable for every sensitive route.
- Migration tests cover empty Vaults, large records, malformed legacy rows, network interruption, duplicate submission, partial completion, and rollback.
- Runtime tests cover current supported mobile and desktop browsers. Source inspection alone is not sufficient.

#### Approval boundary

This is a proposed target, not a statement of implemented functionality. The existing server-decrypted collection endpoint remains active until a separately approved implementation replaces it. No backend changes, database migrations, authentication changes, production deployments, or secret changes are authorized by this document.
