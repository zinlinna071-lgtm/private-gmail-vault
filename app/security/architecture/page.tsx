import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UI/UX Engineering Architecture | Private Account Vault",
  description: "Public engineering notes on the design system, interaction model, motion, accessibility, responsive layout, and verification status behind Private Account Vault.",
  alternates: { canonical: "/security/architecture" },
  openGraph: {
    type: "article",
    title: "UI/UX Engineering Architecture | Private Account Vault",
    description: "How the Vault's visual system is structured, implemented, and reviewed."
  }
};

const stack = [
  { name: "Next.js", version: "15.5.29", role: "Application routing, server-rendered pages, metadata, and route-level composition.", state: "IMPLEMENTED" },
  { name: "React", version: "^19.1.1 (declared range)", role: "Interactive client components, local interface state, and reusable UI composition.", state: "IMPLEMENTED" },
  { name: "TypeScript", version: "^5.9.2 (declared range)", role: "Typed application components, data contracts, and safer refactoring.", state: "IMPLEMENTED" },
  { name: "CSS", version: "Custom stylesheets", role: "Design tokens, responsive layouts, layered surfaces, focus states, and motion rules.", state: "IMPLEMENTED" },
  { name: "Browser APIs", version: "Native platform APIs", role: "Feature-scoped Fetch requests, explicit Clipboard API copy actions, and Web Crypto SHA-256 in the local learning lab.", state: "IMPLEMENTED · FEATURE-SCOPED" }
];

const principles = [
  ["01", "Security by Design", "Visual feedback must never replace authorization, encryption, or server-side validation. A polished interface is not proof of security."],
  ["02", "Art by Design", "The Vault is presented as a private digital collection: architectural space, restrained light, editorial hierarchy, and deliberate negative space."],
  ["03", "Evidence before spectacle", "Historical CI, current source status, conceptual diagrams, and live telemetry are distinct. A visual effect must never impersonate a real security event."],
  ["04", "Clarity over density", "One clear task at a time, readable labels, hidden secrets by default, and explicit read-only or demo boundaries."]
];

const tokens = [
  ["Background", "--vault-bg", "#070f19"],
  ["Panel", "--vault-panel", "#0b1b29"],
  ["Raised panel", "--vault-panel-raised", "#102635"],
  ["Primary text", "--vault-text", "#eafff9"],
  ["Muted text", "--vault-muted", "#9ab6bf"],
  ["Teal accent", "--vault-teal", "#76e3c3"],
  ["Mint highlight", "--vault-mint", "#b8ffeb"],
  ["Card radius", "--vault-radius-card", "18px"],
  ["Control radius", "--vault-radius-control", "10px"],
  ["UI font stack", "--vault-font-ui", "\"Inter\", \"SF Pro Display\", \"Segoe UI\", sans-serif"],
  ["Monospace stack", "--vault-font-mono", "\"SFMono-Regular\", Consolas, monospace"],
  ["Standard easing", "--vault-ease-standard", "cubic-bezier(.2,.75,.25,1)"],
  ["Focus ring", "--vault-focus-ring", "3px teal halo + 1px outline"]
];

const motion = [
  ["Quick", "--motion-quick", "140ms"],
  ["Base", "--motion-base", "240ms"],
  ["Emphasis", "--motion-emphasis", "420ms"],
  ["Entry", "--motion-enter", "560ms"]
];

const responsive = [
  ["900px and below", "The support-page hero and impact layout tighten from their wide desktop composition."],
  ["760px and below", "The security lab console and private research workbench become single-column layouts; navigation spacing also changes."],
  ["680px and below", "Cryptography learning notes and the support-page hero stack vertically; primary learning controls become full-width."],
  ["640px and below", "Research article toolbars and provenance details stack for narrow reading layouts."],
  ["560px and below", "Vault overview statistics become a compact two-column layout, with the final item spanning the row."],
  ["480px and below", "The security lab topology, nodes, top bar, and disclaimer reduce spacing and dimensions."],
  ["420px and below", "Support-page impact values and hero typography use a tighter narrow-screen treatment."]
];

const sources = [
  ["Application shell", "app/layout.tsx"],
  ["Shared public-surface tokens and responsive rules", "app/security-experience.css"],
  ["Authenticated Vault museum layout and shared-palette bridge", "app/globals.css"],
  ["Motion tokens and reduced-motion behavior", "app/motion-system.css"],
  ["Public Security Operations composition", "app/security/page.tsx"],
  ["Bilingual research article interaction", "app/security/research/[slug]/research-article.tsx"],
  ["Design roadmap and release boundaries", "docs/CYBER-VISUAL-ARCHITECTURE.md"]
];

export default function SecurityArchitecturePage() {
  return (
    <main className="security-shell">
      <header className="security-nav">
        <Link className="security-brand" href="/">
          <span className="security-brand-mark">V</span>
          <span>PRIVATE ACCOUNT VAULT <small>UI / UX ENGINEERING NOTES</small></span>
        </Link>
        <nav className="security-nav-links" aria-label="Documentation navigation">
          <Link href="/security">Security operations</Link>
          <Link href="/security/research">Research library</Link>
        </nav>
        <span className="security-nav-status">PUBLIC · DOCUMENTATION</span>
      </header>

      <section className="security-hero">
        <div className="security-hero-copy">
          <div className="security-kicker">DESIGN SYSTEM · IMPLEMENTATION · VERIFICATION</div>
          <h1>Designed with intent.<br /><em>Engineered in the open.</em></h1>
          <p className="security-lead">This page explains the technologies and techniques used to shape the Private Account Vault experience: why they were selected, where they live in the codebase, and what has or has not been verified.</p>
          <p className="security-lead" lang="my">ဒီစာမျက်နှာမှာ Private Account Vault ရဲ့ UI/UX ကို တည်ဆောက်ရာမှာ အသုံးပြုထားတဲ့ နည်းပညာများ၊ ရွေးချယ်ရတဲ့အကြောင်းရင်း၊ Code ထဲမှာ အသုံးပြုထားတဲ့နေရာနဲ့ စစ်ဆေးပြီးမှုအခြေအနေတွေကို ရှင်းပြထားပါတယ်။</p>
          <div className="security-hero-actions">
            <Link href="/security">Security operations ↗</Link>
            <Link href="/security/research">Research publications ↗</Link>
          </div>
        </div>
        <div className="security-signal" role="img" aria-label="Conceptual design architecture, not a live system diagram">
          <div className="signal-grid" />
          <div className="signal-ring signal-ring-one" /><div className="signal-ring signal-ring-two" />
          <div className="signal-core"><span>UX</span><small>DESIGN SYSTEM</small></div>
          <div className="signal-node signal-node-a"><i /> TOKENS & TYPE</div>
          <div className="signal-node signal-node-b"><i /> INTERACTION</div>
          <div className="signal-node signal-node-c"><i /> RESPONSIVE UI</div>
          <div className="signal-caption">CONCEPTUAL DESIGN MAP · NOT LIVE TELEMETRY</div>
        </div>
      </section>

      <section className="security-notice">
        <span className="notice-icon" aria-hidden="true">i</span>
        <div><strong>Documentation status · Initial public edition</strong><p>This page records source-observed implementation, not a completed independent UX audit. Browser-level visual verification across the full device matrix, accessibility audit, and performance profiling remain outstanding unless explicitly marked otherwise.</p></div>
      </section>

      <section className="security-section">
        <div className="security-section-heading"><div><span className="section-index">01 / DESIGN PHILOSOPHY</span><h2>Security by Design. Art by Design.</h2></div><span className="section-aside">FOUNDATION</span></div>
        <div className="security-module-grid">
          {principles.map(([number, title, description]) => <article className="security-module" key={number}><span className="module-number">{number}</span><h3>{title}</h3><p>{description}</p></article>)}
        </div>
        <p className="security-lead" lang="my">Vault ကို သာမန် Lock ပုံစံမဟုတ်ဘဲ ကိုယ်ပိုင် Digital Collection တစ်ခုလို ခံစားရစေဖို့ ရည်ရွယ်ထားပါတယ်။ အလှအပက Security အမှန်တကယ်ရှိတယ်ဆိုတဲ့ သက်သေမဟုတ်ကြောင်းကိုလည်း UI က ရှင်းလင်းစွာ ခွဲပြထားရပါမယ်။</p>
      </section>

      <section className="security-section">
        <div className="security-section-heading"><div><span className="section-index">02 / TECHNOLOGY STACK</span><h2>What the interface is built with.</h2></div><span className="section-aside">PACKAGE MANIFEST</span></div>
        <div className="security-module-grid">
          {stack.map((item) => <article className="security-module" key={item.name}><span className="module-status">{item.state}</span><h3>{item.name} <small>{item.version}</small></h3><p>{item.role}</p></article>)}
        </div>
        <p className="security-footnote">Next.js is pinned in the manifest; React and TypeScript use the declared semver ranges shown above. “Implemented” describes source-observed use, not an independent security, accessibility, or performance certification.</p>
      </section>

      <section className="security-section">
        <div className="security-section-heading"><div><span className="section-index">03 / VISUAL LANGUAGE</span><h2>A quiet, instrument-grade palette.</h2></div><span className="section-aside">SOURCE TOKENS</span></div>
        <p className="security-lead">The public entry, Security surfaces, and authenticated Vault now share a midnight/navy foundation, teal/mint interactive accents, and subdued blue-gray supporting text. The Vault retains its private digital museum identity through editorial composition and restrained warm metallic artwork details; its main surfaces, controls, focus treatment, and text hierarchy are aligned through scoped overrides in `app/globals.css`. The shared token table describes the public system; Vault-specific overrides are documented separately in that stylesheet.</p>
        <div className="security-module-grid">
          {tokens.map(([label, token, value]) => <article className="security-module" key={token}><span className="module-number">{label}</span><h3>{value}</h3><p><code>{token}</code></p></article>)}
        </div>
        <div className="security-module-grid">
          <article className="security-module"><span className="module-number">18.48 : 1</span><h3>Primary text / page background</h3><p><code>#eafff9</code> on <code>#070f19</code> · calculated contrast ratio</p></article>
          <article className="security-module"><span className="module-number">9.00 : 1</span><h3>Muted text / page background</h3><p><code>#9ab6bf</code> on <code>#070f19</code> · calculated contrast ratio</p></article>
          <article className="security-module"><span className="module-number">12.41 : 1</span><h3>Teal accent / page background</h3><p><code>#76e3c3</code> on <code>#070f19</code> · calculated contrast ratio</p></article>
        </div>
        <p className="security-footnote">These ratios are calculated from the listed opaque hex-color pairs using WCAG relative-luminance contrast math. They are palette samples only: translucent surfaces, gradients, images, small labels, and every rendered component still require measured contrast testing. This is not an accessibility conformance claim.</p>
      </section>

      <section className="security-section">
        <div className="security-section-heading"><div><span className="section-index">04 / MOTION ENGINEERING</span><h2>Movement follows interface state.</h2></div><span className="section-aside">CSS TOKENS</span></div>
        <div className="security-module-grid">
          {motion.map(([label, token, value]) => <article className="security-module" key={token}><span className="module-number">{label}</span><h3>{value}</h3><p><code>{token}</code></p></article>)}
        </div>
        <p className="security-lead">CSS transitions and keyframes are used for restrained page entry, focus and hover feedback, dialog/inspector presentation, and visible interaction states. The motion layer is gated by <code>prefers-reduced-motion</code>; reduced-motion rules suppress or shorten animation and transitions.</p>
        <p className="security-footnote">Decorative ambient effects are separate from security telemetry. Counters, packets, events, attack paths, and status indicators must never move unless a real source event or value changes.</p>
      </section>

      <section className="security-section">
        <div className="security-section-heading"><div><span className="section-index">05 / RESPONSIVE ENGINEERING</span><h2>Layouts adapt to the available space.</h2></div><span className="section-aside">CSS BREAKPOINTS</span></div>
        <div className="operation-list">
          {responsive.map(([width, description], index) => <div key={width}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{width}</strong><small>{description}</small></span><em>SOURCE RULE</em></div>)}
        </div>
      </section>

      <section className="security-section">
        <div className="security-section-heading"><div><span className="section-index">06 / ACCESSIBILITY & INTERACTION</span><h2>Usable without relying on motion.</h2></div><span className="section-aside">SOURCE REVIEW</span></div>
        <div className="security-module-grid">
          <article className="security-module"><span className="module-number">01</span><h3>Visible keyboard focus</h3><p>Shared focus-visible outlines are defined for links, buttons, form controls, and focusable elements.</p></article>
          <article className="security-module"><span className="module-number">02</span><h3>Semantic controls</h3><p>Forms, labels, status messages, and accessible names are used across the interfaces. Vault Add/Edit forms move focus to the first field on open and return it to Add account on close.</p></article>
          <article className="security-module"><span className="module-number">03</span><h3>Reduced motion</h3><p>Motion preferences are read through the CSS media feature; essential content does not depend on animation.</p></article>
        </div>
        <p className="security-footnote">These are source-level observations. A complete keyboard-only, screen-reader, contrast, and assistive-technology audit has not yet been recorded as verified.</p>
      </section>

      <section className="security-section security-method">
        <div><span className="section-index">07 / IMPLEMENTATION EVIDENCE</span><h2>Trace every design decision to source.</h2><p className="security-lead">The files below are the current implementation references. Their presence is inspectable in the repository; the next verification stage is to attach repeatable visual, interaction, accessibility, and performance test evidence.</p></div>
        <div className="method-steps">
          {sources.map(([label, path], index) => <div key={path}><b>{String(index + 1).padStart(2, "0")}</b><span><strong>{label}</strong><small><a href={`https://github.com/zinlinna071-lgtm/private-gmail-vault/blob/design/cyber-visual-architecture/${path.replaceAll(" ", "%20")}`} target="_blank" rel="noreferrer">{path} ↗</a></small></span></div>)}
        </div>
      </section>

      <section className="security-section">
        <div className="security-section-heading"><div><span className="section-index">08 / VERIFICATION ROADMAP</span><h2>Implemented is not the same as verified.</h2></div><span className="section-aside">TRANSPARENT STATUS</span></div>
        <div className="security-module-grid">
          <article className="security-module"><span className="module-status">IMPLEMENTED</span><h3>Shared visual foundation</h3><p>Shared CSS tokens, entry transitions, interactive feedback, and reduced-motion rules exist in source.</p></article>
          <article className="security-module"><span className="module-status">IMPLEMENTED</span><h3>Public research reading UI</h3><p>Research pages include bilingual switching, structured sections, and provenance fields.</p></article>
          <article className="security-module"><span className="module-status status-untested">NOT VERIFIED</span><h3>Cross-device visual QA</h3><p>Repeatable browser screenshots and layout checks across representative mobile, tablet, and desktop viewports.</p></article>
          <article className="security-module"><span className="module-status status-untested">NOT VERIFIED</span><h3>Accessibility audit</h3><p>Keyboard-only, screen-reader, contrast, zoom, and reduced-motion behavior under a documented test protocol.</p></article>
          <article className="security-module"><span className="module-status status-untested">NOT VERIFIED</span><h3>Performance profiling</h3><p>Measured rendering cost, animation smoothness, Core Web Vitals, and low-end mobile behavior.</p></article>
          <article className="security-module"><span className="module-status status-untested">PLANNED</span><h3>Design change log</h3><p>Versioned before/after evidence, decision rationale, and owner-reviewed outcomes for future design iterations.</p></article>
        </div>
      </section>

      <section className="security-section">
        <div className="security-section-heading"><div><span className="section-index">09 / QA PROTOCOL</span><h2>What must be checked before verification is claimed.</h2></div><span className="section-aside">PLANNED · NOT RUN</span></div>
        <div className="operation-list">
          <div><b>01</b><span><strong>Viewport sweep</strong><small>Run the same route at 360, 390, 768, 1024, and 1440 CSS pixels; check overflow, navigation, content order, dialogs, and touch target spacing.</small></span><em>PLANNED</em></div>
          <div><b>02</b><span><strong>Keyboard-only journey</strong><small>Tab through navigation, forms, dialogs, reveal/copy actions, and close controls; verify visible focus, logical order, and no keyboard trap.</small></span><em>PLANNED</em></div>
          <div><b>03</b><span><strong>Reduced-motion pass</strong><small>Enable the operating-system reduced-motion preference; confirm nonessential movement is suppressed and all content and state changes remain understandable.</small></span><em>PLANNED</em></div>
          <div><b>04</b><span><strong>Assistive technology</strong><small>Review accessible names, landmarks, headings, status announcements, and dialog semantics with a screen reader.</small></span><em>PLANNED</em></div>
          <div><b>05</b><span><strong>Rendered contrast</strong><small>Measure actual text against rendered surfaces, including translucent panels, gradients, hover/focus states, and disabled controls.</small></span><em>PLANNED</em></div>
          <div><b>06</b><span><strong>Performance profile</strong><small>Capture mobile and desktop traces; inspect layout shifts, long tasks, animation smoothness, and Core Web Vitals under repeatable conditions.</small></span><em>PLANNED</em></div>
        </div>
        <p className="security-footnote">No browser-run evidence is attached to this edition. These are the acceptance checks for the next QA pass, not completed test results.</p>
      </section>

      <footer className="security-footer">
        <div><span className="security-brand-mark">V</span><strong>PRIVATE ACCOUNT VAULT</strong></div>
        <p>Public engineering notes describe the current source, not a certification or guarantee of security.</p>
        <div className="security-footer-links"><Link href="/security">Security operations ↗</Link><Link href="/security/research">Research library ↗</Link><Link href="/">Return to Vault</Link></div>
      </footer>
    </main>
  );
}
