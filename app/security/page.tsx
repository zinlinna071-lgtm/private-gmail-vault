import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security Operations & Research | Private Account Vault",
  description: "Evidence-led security research, attack-surface mapping, test scope, and public verification records."
};

const checks = [
  { name: "RFC 9106 Argon2id known-answer vector", scope: "Node.js · isolated harness", run: "42272387331", href: "https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42272387331", detail: "Candidate KDF output matched the published test vector." },
  { name: "Argon2id browser compatibility", scope: "Chromium · hosted Linux", run: "42281120467", href: "https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42281120467", detail: "Browser implementation passed the isolated compatibility checks." },
  { name: "Cross-engine browser verification", scope: "Chromium · Firefox · WebKit", run: "42281411743", href: "https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42281411743", detail: "The same candidate checks passed across the three hosted browser engines." }
];

const modules = [
  ["01", "Identity & login gateway", "Credential handling, login throttling, error behavior, MFA boundaries, and account enumeration resistance.", "NOT TESTED"],
  ["02", "Session lifecycle", "Cookie flags, session rotation, expiry, logout invalidation, and replay resistance.", "PLANNED"],
  ["03", "Key derivation & unlock", "Argon2id compatibility, parameter review, unlock flow, and key-handling boundaries.", "TESTED · LIMITED"],
  ["04", "Vault encryption", "AES-GCM record integrity, DEK wrapping, nonce discipline, and client/server trust boundaries.", "IN PROGRESS"],
  ["05", "Authorization & isolation", "Ownership enforcement, cross-account access denial, and IDOR regression checks.", "PLANNED"],
  ["06", "API & browser boundary", "Input validation, origin checks, XSS defenses, security headers, and abuse controls.", "PARTIAL"],
  ["07", "Recovery & migration", "Recovery design, key rotation, migration safety, and prevention of hidden key escrow.", "DESIGN"],
  ["08", "Supply chain & runtime", "Dependency integrity, build provenance, deployment configuration, and runtime exposure.", "PLANNED"]
];

const attackSurface = [
  ["01", "Public edge", "HTTPS, routing, headers, request limits", "Gateway boundary"],
  ["02", "Login gateway", "Credential verification, throttling, MFA boundary", "Identity boundary"],
  ["03", "Session layer", "Cookie scope, rotation, expiry, revocation", "Session boundary"],
  ["04", "Application API", "Input schemas, authorization, ownership checks", "Service boundary"],
  ["05", "Vault crypto", "DEK envelope, AES-GCM integrity, unlock lifecycle", "Cryptographic boundary"],
  ["06", "Storage layer", "Ciphertext exposure, backups, retention, isolation", "Data boundary"]
];

export default function SecurityPage() {
  return (
    <main className="security-shell">
      <header className="security-nav">
        <Link className="security-brand" href="/">
          <span className="security-brand-mark">V</span>
          <span>PRIVATE ACCOUNT VAULT <small>SECURITY OPERATIONS CENTER</small></span>
        </Link>
        <nav className="security-nav-links" aria-label="Security navigation">
          <a href="#surface">Attack surface</a><a href="#evidence">Evidence</a><Link href="/security/research">Research</Link>
        </nav>
        <span className="security-nav-status"><i /> PUBLIC · READ ONLY</span>
      </header>

      <section className="security-hero">
        <div className="security-hero-copy">
          <div className="security-kicker"><span className="pulse-dot" /> RESEARCH · VERIFICATION · TRANSPARENCY</div>
          <h1>Understand the surface.<br /><em>Prove the defense.</em></h1>
          <p className="security-lead">A public window into the security work behind Private Account Vault: what is in scope, what has actually been tested, what remains open, and the evidence behind each published result.</p>
          <div className="security-hero-meta">
            <span><b>LAB SCOPE</b> Isolated · Authorized</span>
            <span><b>PUBLIC ACCESS</b> Read-only reporting</span>
            <span><b>RECORD DATE</b> 07 NOV 2026</span>
          </div>
          <div className="security-hero-actions"><a href="#surface">Explore attack surface <span>↓</span></a><Link href="/security/research">Research library ↗</Link></div>
        </div>
        <div className="security-signal" aria-label="Conceptual system architecture map">
          <div className="signal-grid" />
          <div className="signal-ring signal-ring-one" /><div className="signal-ring signal-ring-two" />
          <div className="signal-core"><span>V</span><small>VAULT CORE</small></div>
          <div className="signal-node signal-node-a"><i /> IDENTITY GATEWAY</div>
          <div className="signal-node signal-node-b"><i /> CRYPTO BOUNDARY</div>
          <div className="signal-node signal-node-c"><i /> API AUTHORIZATION</div>
          <div className="signal-scan" />
          <div className="signal-caption">CONCEPTUAL ARCHITECTURE · NOT LIVE TELEMETRY</div>
        </div>
      </section>

      <section className="security-notice">
        <span className="notice-icon">!</span>
        <div><strong>Prototype status — not independently audited</strong><p>Zero-knowledge is a target architecture, not a completed feature. The current API still decrypts vault data server-side, and the legacy authentication flow remains. Do not store high-value real credentials in this prototype. No real-user account is used as a security-test target.</p></div>
      </section>

      <section className="security-section" id="surface">
        <div className="security-section-heading"><div><span className="section-index">01 / ATTACK SURFACE</span><h2>The login screen is only the front door.</h2></div><span className="section-aside">SYSTEM BOUNDARIES</span></div>
        <p className="security-lead">A secure application must defend every boundary after sign-in too. The map below defines the areas the private lab will examine using synthetic accounts, controlled fixtures, and explicitly authorized environments.</p>
        <div className="surface-flow" aria-label="Conceptual request path through application security layers">
          {attackSurface.map(([number, title, description, boundary], index) => (
            <div className="surface-step" key={number}>
              <div className="surface-step-top"><span>{number}</span><small>{boundary}</small></div>
              <h3>{title}</h3><p>{description}</p>
              {index < attackSurface.length - 1 && <div className="surface-connector" aria-hidden="true">↓</div>}
            </div>
          ))}
        </div>
        <p className="security-footnote">This is an architecture and test-scope map, not a claim that every layer has already been penetration-tested. The login gateway is one target among several; session, API, authorization, cryptography, storage, recovery, and deployment boundaries matter too.</p>
      </section>

      <section className="security-section" id="evidence">
        <div className="security-section-heading"><div><span className="section-index">02 / VERIFIED EVIDENCE</span><h2>What has actually passed</h2></div><span className="section-aside">CI RECORDS</span></div>
        <div className="security-evidence-list">
          {checks.map((check) => (
            <article className="security-evidence" key={check.run}>
              <div className="evidence-icon">✓</div>
              <div className="evidence-copy"><h3>{check.name}</h3><p>{check.scope}</p><small>GitHub Actions · Run #{check.run}</small><p className="evidence-detail">{check.detail}</p></div>
              <span className="evidence-pass">PASSED</span>
              <a href={check.href} target="_blank" rel="noreferrer">INSPECT RUN ↗</a>
            </article>
          ))}
        </div>
        <p className="security-footnote">These records verify the named Argon2id candidate compatibility checks only. They are not authentication penetration tests, do not approve production KDF parameters, and do not prove end-to-end Vault security.</p>
      </section>

      <section className="security-section">
        <div className="security-section-heading"><div><span className="section-index">03 / RESEARCH MATRIX</span><h2>Security domains under review</h2></div><span className="section-aside">SCOPE & STATUS</span></div>
        <div className="security-module-grid">
          {modules.map(([number, title, description, status]) => (
            <article className="security-module" key={number}>
              <span className="module-number">{number}</span><span className={status.includes("NOT TESTED") ? "module-status status-untested" : "module-status"}>{status}</span>
              <h3>{title}</h3><p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="security-section security-operations">
        <div><span className="section-index">04 / PRIVATE LAB OPERATIONS</span><h2>Real tests. Controlled scope. Review before release.</h2><p className="security-lead">Security testing is performed privately against isolated test systems. Public visitors can inspect approved outcomes, but cannot launch scans, submit payloads, or access the lab.</p></div>
        <div className="operation-list">
          <div><b>01</b><span><strong>Authorize & isolate</strong><small>Confirm ownership, written scope, test accounts, and non-production fixtures.</small></span><em>REQUIRED</em></div>
          <div><b>02</b><span><strong>Execute & capture</strong><small>Run controlled checks and retain test IDs, commit, runtime, and evidence.</small></span><em>PRIVATE</em></div>
          <div><b>03</b><span><strong>Remediate & retest</strong><small>Record findings, severity, fix, and a repeatable verification result.</small></span><em>TRACEABLE</em></div>
          <div><b>04</b><span><strong>Review & publish</strong><small>Technical, privacy, security, and bilingual review followed by owner approval.</small></span><em>APPROVAL GATE</em></div>
        </div>
      </section>

      <section className="security-section security-method">
        <div><span className="section-index">05 / RESEARCH PUBLICATIONS</span><h2>Evidence becomes knowledge.</h2><p className="security-lead">Approved papers document objectives, safe methodology, isolated environment, findings, remediation, retest results, limitations, and references in English and Burmese.</p><Link href="/security/research">Open the bilingual research library ↗</Link><p className="security-footnote" style={{ marginTop: 16 }}>Authentication testing plan: <a href="https://github.com/zinlinna071-lgtm/private-gmail-vault/blob/feature/vault-authentication/docs/SECURITY-LOGIN-TEST-PLAN.md" target="_blank" rel="noreferrer">review the Vault Login Security Test Plan ↗</a></p></div>
        <div className="method-steps">
          <div><b>01</b><span><strong>Draft from verified evidence</strong><small>No invented findings, fabricated telemetry, or synthetic publications.</small></span></div>
          <div><b>02</b><span><strong>Technical and security review</strong><small>Check reproducibility, severity, redaction, and disclosure safety.</small></span></div>
          <div><b>03</b><span><strong>Bilingual review</strong><small>Keep English and Burmese versions aligned under one publication ID.</small></span></div>
          <div><b>04</b><span><strong>Owner approval</strong><small>Only approved versions become publicly visible, with web and PDF records.</small></span></div>
        </div>
      </section>

      <footer className="security-footer">
        <div><span className="security-brand-mark">V</span><strong>PRIVATE ACCOUNT VAULT</strong></div>
        <p>Transparency is not certification. A passed test describes one check, one revision, and one environment. No software can honestly promise to be unhackable.</p>
        <div className="security-footer-links"><Link href="/support">Research Fund Transparency ↗</Link><Link href="/">Return to Vault</Link></div>
      </footer>
    </main>
  );
}
