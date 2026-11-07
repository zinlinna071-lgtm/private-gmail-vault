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
