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
