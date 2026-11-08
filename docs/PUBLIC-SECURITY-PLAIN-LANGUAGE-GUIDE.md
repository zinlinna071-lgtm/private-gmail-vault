# Public Security Guide — Plain-Language Edition

**Status:** Public-facing educational content; source implementation added on the design branch.  
**Route:** /security/guide  
**Audience:** People with no cybersecurity or programming background.  
**Languages:** English with short Burmese explanations.  
**Scope:** Education and transparent explanation only. This is not a certification, security audit, or promise that the Vault cannot be compromised.

## Editorial rules

1. Explain the practical meaning before introducing a technical term.
2. Use familiar analogies carefully and state where an analogy ends.
3. Never turn a single passing test into a claim that the whole application is secure.
4. Keep **PASS**, **NOT RUN**, **LIMITED**, **PLANNED**, **IMPLEMENTED**, and **VERIFIED** distinct.
5. Display only real, authorized test outcomes with traceable source and environment details.
6. Mark conceptual diagrams as conceptual; never style decorative motion as live telemetry.
7. Keep secrets, credentials, recovery codes, private identifiers, and sensitive exploit details out of public material.
8. Present English first, with Burmese explanations alongside the most important ideas. Maintain meaning across languages rather than mechanically translating interface labels.

## Four ideas for non-technical readers

### 1. Signing in answers: who are you?

A sign-in check confirms which account is asking to enter. It is similar to showing an identity card at a reception desk. It does not, by itself, prove that every stored record is protected from every kind of attack.

**မြန်မာလို:** Login ဝင်ခြင်းက ဘယ်သူက ဝင်ရောက်ခွင့်တောင်းနေသလဲဆိုတာ စစ်ဆေးပေးတာပါ။ ဒါတစ်ခုတည်းနဲ့ သိမ်းထားတဲ့အချက်အလက်အားလုံး လုံခြုံပြီလို့ မဆိုနိုင်ပါဘူး။

### 2. Encryption makes information unreadable without the right key

Encryption changes readable information into a protected form. A correct cryptographic key is needed to turn it back into readable information. A sealed-letter analogy helps explain the idea, but digital encryption is implemented by mathematical algorithms, not a physical lock.

**မြန်မာလို:** Encryption ဆိုတာ ဖတ်လို့ရတဲ့အချက်အလက်ကို သင့်တော်တဲ့ key မရှိဘဲ နားလည်ဖတ်ရှုမရတဲ့ပုံစံအဖြစ် ပြောင်းထားခြင်းပါ။ စာတစ်စောင်ကို သော့ခတ်ထားတဲ့အိတ်ထဲ ထည့်ထားသလို ဥပမာပေးနိုင်ပါတယ်။

### 3. A security test checks one promise at a time

A known-answer test gives a cryptographic algorithm a published sample and checks whether its output exactly matches the expected answer. A tamper test changes part of protected data and checks whether the change is rejected.

**မြန်မာလို:** Known-answer test က စံနှုန်းမှာ ဖော်ပြထားတဲ့ နမူနာအချက်အလက်ကို ထည့်ပြီး ထွက်လာတဲ့အဖြေ မှန်မမှန် တိုက်စစ်တာပါ။ Tamper test က ကာကွယ်ထားတဲ့ဒေတာကို နည်းနည်းပြောင်းကြည့်ပြီး စနစ်က လက်မခံဘဲ ပယ်ချနိုင်မနိုင် စစ်တာပါ။

### 4. A green tick is not a whole-product guarantee

**PASS** means the named check worked for the recorded code revision and test environment. It does not mean every application component was tested, that no attack is possible, or that the product has been independently certified.

**မြန်မာလို:** PASS ဆိုတာ ဖော်ပြထားတဲ့ စမ်းသပ်ချက်တစ်ခုက သတ်မှတ်ထားတဲ့ code version နဲ့ စမ်းသပ်ပတ်ဝန်းကျင်မှာ အောင်မြင်ခဲ့တယ်လို့သာ ဆိုလိုပါတယ်။ App တစ်ခုလုံး လုံးဝလုံခြုံတယ်ဆိုတဲ့ အာမခံချက် မဟုတ်ပါဘူး။

## Status vocabulary

| Label | Meaning for a public reader |
|---|---|
| PASS | This exact named check succeeded in the recorded environment. |
| FAIL | This exact named check did not meet its expected result. The failure scope must be explained. |
| NOT RUN | There is no execution result yet. Do not present it as success. |
| LIMITED | Only a specific part or layer was reviewed or tested. |
| PLANNED | A future task or design idea; it is not implemented. |
| IMPLEMENTED | Source code or a test exists; runtime success is not implied. |
| VERIFIED | The stated verification method completed and has inspectable evidence. |

A source-code review is not the same as executing a test. A local command is not the same as hosted CI. Hosted browser engines are not the same as physical phones.

## Small glossary

- **Encryption:** Changing readable information into protected data that requires the right key to read.
- **Cryptographic key:** A secret value used by an encryption system to protect or unlock information.
- **Known-answer test:** Comparing an algorithm's output with a trusted published expected answer.
- **Tamper detection:** Rejecting protected data when it has been changed without the correct key.
- **Zero-knowledge:** An architecture designed so the service provider does not receive the user's readable secrets or unlock keys. The current Vault prototype does **not** provide this property.

## How public security reporting should work

### What visitors can inspect
- The intended security scope and architecture boundaries.
- The specific test that was run and its result.
- The repository revision, runtime, browser or operating-system environment, and original CI record where available.
- A finding's severity, safe summary, remediation, and retest evidence after review and approval.
- Design and implementation notes that identify what is implemented, tested, verified, or still planned.

### What visitors cannot do
- Launch scans or tests against the private lab.
- Submit arbitrary payloads to the private environment.
- Read private Vault records, credentials, keys, recovery material, or raw sensitive evidence.

### What must never be fabricated
- Live attacks, packet streams, intrusion counters, login attempts, network events, or success/failure metrics.
- A passing result when a workflow never reached its test steps.
- Physical mobile compatibility based only on a hosted desktop browser.
- A security score or certification unsupported by a named standard and formal assessment.

When no real test is active, show an explicit standby or unavailable state. A conceptual diagram must be labelled as conceptual and not live telemetry.

## Current prototype limitation — must remain visible

The current Vault API decrypts records server-side and returns readable values to an authenticated browser. The application therefore uses server-mediated encryption and is **not zero-knowledge**. The proposed client-key architecture is design-only until implemented and reviewed.

Users should not store high-value real credentials in this prototype. This warning must not be hidden behind a technical glossary.

## Browser cryptography test scope

The isolated browser compatibility harness checks public known-answer values for:
- HKDF-SHA-256 using RFC 5869 Test Case 1.
- AES-256-GCM encryption/decryption using two NIST CAVP-origin vectors.
- Rejection when ciphertext/tag, IV, authenticated data, or key is changed.

The harness uses a previously existing isolated Playwright tool package. It does not import Vault application code, make application API requests, change production dependencies, or use real credentials.

A browser-matrix run may be reported as passed only after the workflow reaches and completes the test in Chromium, Firefox, and WebKit. A runner failure before checkout or before any test step is **UNRESOLVED / NOT RUN**, not a cryptographic failure or a pass.

A hosted desktop browser result is not a physical-device performance result. Android/iOS Argon2id performance and memory behavior remain separate checks requiring real devices.

## Publication workflow

Public research and findings must follow:

**Draft → Technical review → Sensitive-data/security review → Bilingual review → Owner approval → Publish**

A paper should identify its objective, scope, safe methodology, isolated environment, evidence, findings, severity, remediation, retest, limitations, and references. Public content must be reviewed for privacy and disclosure risk before publication.

## Source of truth

- Public page: app/security/guide/page.tsx
- Page styles: app/security/guide/guide.module.css
- Browser harness: tools/crypto-primitives-spike/browser-test-entry.js
- Browser runner: tools/argon2id-browser-spike/run-crypto-primitives-browser-test.mjs
- Workflow: .github/workflows/vault-crypto-primitives-browser.yml
- Cryptographic vector catalog: docs/VAULT-CRYPTO-TEST-VECTOR-CATALOG.md

Update this guide when the implementation or verification status changes. Never change a status label merely because a test was scheduled or a workflow was triggered.


## Visual teaching system

The beginner page is not intended to be text-only. It uses several complementary ways to explain one idea:

1. **Short plain-language explanation** before introducing the technical term.
2. **Bilingual support** for the most important ideas, with English as the primary interface language.
3. **Process diagrams** showing readable information → encryption process and key → protected data.
4. **Before/after comparison** showing the conceptual difference between unchanged and altered protected data during an integrity check.
5. **Evidence ladder** distinguishing source review, local test, hosted browser/CI, and physical-device testing.
6. **Status labels and glossary** for readers who want to inspect the technical terms and test boundaries.

All teaching diagrams are explicitly marked **CONCEPT ONLY** or **HOW TO READ**. Their sample data blocks are illustrative placeholders. They do not execute cryptography, show actual Vault payloads, or represent live telemetry. The evidence ladder explains categories of evidence; it is not a claim that all four levels have passed.

### Visual design principles

- Use a small number of steps and familiar language.
- Keep one idea per diagram.
- Use labels and captions in addition to color, so meaning is not color-only.
- Keep diagrams responsive and readable on narrow mobile screens.
- Respect reduced-motion preferences; the diagrams do not depend on animation.
- Do not use charts for fabricated or unavailable measurements.
- If future interactive learning demonstrations are added, keep them isolated from the real Vault and label them as simulations or local demonstrations.

Update this section whenever the public learning visuals change.


## Evidence and imagery integrity — mandatory

The public security experience must never invent facts, measurements, events, outcomes, or evidence. It must also avoid imagery that could reasonably be mistaken for factual system output.

- Do not create fake packet streams, terminal output, scan paths, attack maps, traffic charts, activity counters, heat maps, timelines, or success dashboards.
- Do not use decorative animation, glowing nodes, moving lines, or radar-like effects in a way that resembles live network activity or a running test.
- Prefer plain-language text, labelled architecture steps, tables, and diagrams whose meaning is explicit.
- A conceptual diagram is allowed only when it is clearly labelled **CONCEPT ONLY** and does not resemble captured telemetry, a real test result, or a measured graph.
- Illustrative sample values must be identified next to the sample, not only in a distant page disclaimer. Never use plausible-looking random values as visual filler.
- A graph may be shown only when its underlying values come from an identified, inspectable source and the units, time range, collection method, and limitations are stated.
- If no verified data exists, show the factual state plainly: **STANDBY**, **NOT RUN**, **NOT AVAILABLE**, or **NO PUBLISHED EVIDENCE**, whichever is accurate. Do not fill empty space with simulated data.
- Keep the two reading levels together: a short everyday explanation first, followed by expandable or adjacent technical detail such as algorithm, test vector, commit, environment, and source record.
- English is the primary interface language. Add Burmese explanations where they improve understanding, without mechanically translating every technical label.

This rule applies to the Public Security Dashboard, Research Library, Security Guide, UI/UX Architecture page, login, Vault, and Private Security Lab. Visual polish must never make a claim appear more certain than its evidence.
