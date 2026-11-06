import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security & Transparency | Private Account Vault",
  description: "Public, read-only security testing methods, verified evidence, and development status for Private Account Vault."
};

const checks = [
  { name: "RFC 9106 Argon2id known-answer vector", scope: "Node.js · isolated harness", run: "42272387331", href: "https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42272387331" },
  { name: "Argon2id browser compatibility", scope: "Chromium · hosted Linux", run: "42281120467", href: "https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42281120467" },
  { name: "Cross-engine browser verification", scope: "Chromium · Firefox · WebKit", run: "42281411743", href: "https://github.com/zinlinna071-lgtm/private-gmail-vault/actions/runs/42281411743" }
];

const modules = [
  ["01", "Authentication & sessions", "Separate identity verification from local Vault unlock.", "IN PROGRESS"],
  ["02", "Password derivation", "RFC known-answer and browser-engine compatibility checks.", "TESTED · LIMITED"],
  ["03", "Client-side encryption", "AES-GCM records and wrapped data-encryption key.", "IN PROGRESS"],
  ["04", "Authorization & isolation", "Cross-account access, ownership, and IDOR regression checks.", "PLANNED"],
  ["05", "API & browser defenses", "Origin validation, bounded input, XSS and security headers.", "PARTIAL"],
  ["06", "Recovery & migration", "Recovery without server-side decryption or hidden key escrow.", "DESIGN"]
];

export default function SecurityPage() {
  return (
    <main className="security-shell">
      <header className="security-nav">
        <Link className="security-brand" href="/">
          <span className="security-brand-mark">V</span>
          <span>PRIVATE ACCOUNT VAULT <small>SECURITY CENTER</small></span>
        </Link>
        <span className="security-nav-status"><i /> PUBLIC · READ ONLY</span>
      </header>

      <section className="security-hero">
        <div className="security-kicker"><span className="pulse-dot" /> SECURITY RESEARCH & VERIFICATION</div>
        <h1>Trust is earned.<br /><em>Security is tested.</em></h1>
        <p className="security-lead">A transparent record of the controls we test, the weaknesses we investigate, and the evidence behind every published result.</p>
        <div className="security-hero-meta">
          <span><b>ENVIRONMENT</b> Isolated test harnesses</span>
          <span><b>ACCESS</b> Public reporting only</span>
          <span><b>UPDATED</b> 07 NOV 2026</span>
        </div>
        <div className="security-signal" aria-label="Illustrative security testing visualization">
          <div className="signal-grid" />
          <div className="signal-ring signal-ring-one" />
          <div className="signal-ring signal-ring-two" />
          <div className="signal-core"><span>V</span><small>VAULT CORE</small></div>
          <div className="signal-node signal-node-a"><i /> INPUT VALIDATION</div>
          <div className="signal-node signal-node-b"><i /> KEY DERIVATION</div>
          <div className="signal-node signal-node-c"><i /> DATA INTEGRITY</div>
          <div className="signal-scan" />
          <div className="signal-caption">ILLUSTRATIVE SYSTEM MAP · NOT A LIVE ATTACK</div>
        </div>
      </section>

      <section className="security-notice">
        <span className="notice-icon">!</span>
        <div><strong>Development status — not independently audited</strong><p>The zero-knowledge architecture is a target, not a completed feature. The current application still has server-readable vault data and a legacy authentication flow. Do not store high-value real credentials in this prototype.</p></div>
      </section>

      <section className="security-section">
        <div className="security-section-heading"><div><span className="section-index">01 / EVIDENCE</span><h2>Verified test runs</h2></div><span className="section-aside">PUBLIC RECORD</span></div>
        <div className="security-evidence-list">
          {checks.map((check) => (
            <article className="security-evidence" key={check.run}>
              <div className="evidence-icon">✓</div>
              <div className="evidence-copy"><h3>{check.name}</h3><p>{check.scope}</p><small>GitHub Actions · Run #{check.run}</small></div>
              <span className="evidence-pass">PASSED</span>
              <a href={check.href} target="_blank" rel="noreferrer">VIEW EVIDENCE ↗</a>
            </article>
          ))}
        </div>
        <p className="security-footnote">These runs verify the named Argon2id candidate compatibility checks only. They do not prove end-to-end Vault security, approve production KDF parameters, or replace real-device testing and independent review.</p>
      </section>

      <section className="security-section">
        <div className="security-section-heading"><div><span className="section-index">02 / TEST MATRIX</span><h2>What we are testing</h2></div><span className="section-aside">SCOPE & STATUS</span></div>
        <div className="security-module-grid">
          {modules.map(([number, title, description, status]) => (
            <article className="security-module" key={number}>
              <span className="module-number">{number}</span><span className="module-status">{status}</span>
              <h3>{title}</h3><p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="security-section security-method">
        <div><span className="section-index">03 / METHOD</span><h2>Reproducible. Scoped. Honest.</h2></div>
        <div className="method-steps">
          <div><b>01</b><span><strong>Isolated execution</strong><small>Tests run against synthetic data and controlled environments.</small></span></div>
          <div><b>02</b><span><strong>Evidence captured</strong><small>Each result is tied to a commit, test ID, runtime, and CI record.</small></span></div>
          <div><b>03</b><span><strong>Review & redaction</strong><small>Secrets and private infrastructure details are removed before publication.</small></span></div>
          <div><b>04</b><span><strong>Public verification</strong><small>Visitors can inspect methods and evidence but cannot launch tests.</small></span></div>
        </div>
      </section>

      <section className="security-section">
        <div className="security-section-heading"><div><span className="section-index">04 / RESEARCH</span><h2>Research publications</h2></div><span className="section-aside">EN · MY</span></div>
        <p className="security-lead">Read approved cybersecurity research papers in English and Burmese, with evidence-backed findings and remediation history.</p>
        <p className="security-lead" lang="my">အတည်ပြုထားသော ဆိုက်ဘာလုံခြုံရေး သုတေသနစာတမ်းများကို အင်္ဂလိပ်နှင့် မြန်မာဘာသာနှစ်မျိုးဖြင့် ဖတ်ရှုနိုင်မည့်နေရာ။</p>
        <Link href="/security/research">Open the bilingual research library ↗</Link>
      </section>

      <footer className="security-footer">
        <div><span className="security-brand-mark">V</span><strong>PRIVATE ACCOUNT VAULT</strong></div>
        <p>Security transparency, not a security certification. No software can honestly promise to be unhackable.</p>
        <Link href="/">Return to Vault</Link>
      </footer>
    </main>
  );
}
