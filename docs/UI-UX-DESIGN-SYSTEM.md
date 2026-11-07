# Private Security Lab — UI/UX Design System

**Status:** Initial design direction, implemented incrementally on `feature/vault-authentication`  
**Product character:** Editorial precision × instrument-grade observability × evidence-first trust.

## 1. Design thesis

The interface should feel like a carefully engineered research instrument, not a game-like hacker movie dashboard. Use expressive editorial typography and deliberate composition for hierarchy; use compact monospaced labels, fine rules, calibrated color, and restrained motion for technical detail.

The experience must be visually memorable without inventing activity, status, or security outcomes.

## 2. Visual principles

- **Quiet confidence:** Midnight blue-green surfaces, restrained mint/cyan accents, warm amber for caution, muted red for unavailable/error states.
- **Editorial hierarchy:** Large balanced headlines, concise explanatory copy, generous section spacing, and a clear reading rhythm.
- **Instrument detail:** Small uppercase section indices, monospaced source labels, tabular numerals, precise dividers, and consistent status language.
- **Depth without clutter:** Layered surfaces, subtle glass blur, fine grid textures, and restrained light—not excessive glow on every element.
- **Responsive composition:** Desktop may use multi-panel workstations; mobile becomes a deliberate vertical reading and control flow, not a compressed desktop.
- **Accessible motion:** Motion must communicate a real state transition; honor `prefers-reduced-motion`, keyboard focus, contrast, and touch target needs.

## 3. Data integrity is part of the visual system

Every displayed operational value must have a real source and a defined meaning. Components must never invent telemetry to make a screen look active.

| State | Required presentation |
|---|---|
| Connected with recent verified events | Show source-backed events, timestamps, and trace/evidence references |
| Connected, no events | `No events received` |
| Source not configured | `Telemetry not connected` |
| Source unreachable | `Source unavailable` with last verified contact only if recorded |
| Data older than freshness threshold | `Stale data` with the actual event timestamp |
| Test not executed | `No test recorded` / `Not tested` |
| Test failed | Show the actual failed result and linked run |
| Partial evidence | State the exact scope and limitation; never imply broader assurance |

A browser clock may be labelled as a local UI timestamp, but must not be presented as a system event timestamp. No random counters, fake trace IDs, generated attack narratives, fabricated health states, or demo events in production-facing views.

## 4. Motion grammar

- Use motion for navigation feedback, focus, expansion, and real status changes.
- Do not animate network packets or telemetry bars unless they are driven by received source events.
- Decorative ambient motion must be explicitly decorative and must not resemble live operational signals.
- Avoid continuous animation on unavailable/offline states.
- Provide a reduced-motion equivalent for every meaningful interaction.

## 5. Component quality gates

Before a component is considered complete, verify:
1. Keyboard operation and visible focus.
2. Screen-reader labels and meaningful status announcements.
3. Mobile layout at narrow widths.
4. Loading, empty, error, offline, and populated states.
5. Data provenance for every operational claim.
6. No client-side logging or exposure of credentials, tokens, or sensitive evidence.
7. No visual state that implies a test or connection that did not occur.

## 6. Current implementation notes

- The public observability console is an evidence-first empty state until a trusted event source is integrated.
- The topology illustration is explicitly a reference architecture, not a live network map.
- Historical CI evidence remains linked to its original GitHub Actions runs and is not presented as a live attack feed.
- Private Vault summary metrics must continue to derive from authenticated, loaded records only.


## 7. Interactive cryptography learning lab

The public SHA-256 workbench uses the browser Web Crypto API to calculate a real digest from the visitor's text. The component does not send the input to the application server or persist it. It reports the actual UTF-8 byte count and only displays a digest after a successful browser calculation. It explicitly explains that SHA-256 is not encryption and is not a password-storage function. No sample digest, generated telemetry, or fabricated output is substituted when the browser API is unavailable.
