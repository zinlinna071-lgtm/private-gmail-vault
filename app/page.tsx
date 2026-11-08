import Link from "next/link";
import AuthPanel from "./auth-panel";
import "./entry-experience.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Private Account Vault | Security Access",
  description: "A private account vault with an evidence-led cybersecurity research and transparency program.",
  robots: { index: false, follow: false, noarchive: true }
};

export default function Home() {
  return (
    <main className="entry-shell">
      <nav className="entry-nav" aria-label="Main navigation">
        <div className="entry-brand">
          <span className="entry-brand-mark" aria-hidden="true">V</span>
          <span>PRIVATE ACCOUNT VAULT</span>
        </div>
        <div className="entry-nav-links">
          <Link href="/security">SECURITY</Link>
          <Link href="/curator-preview">THE CURATOR’S SIGNAL</Link>
          <Link href="/support">RESEARCH FUND</Link>
        </div>
        <div className="entry-nav-status"><i /> AUTHENTICATION REQUIRED</div>
      </nav>

      <div className="entry-grid">
        <section className="entry-copy">
          <div className="entry-kicker">PRIVATE ACCESS GATEWAY</div>
          <h1 className="entry-title">Your digital life.<br /><span>Behind a shield.</span></h1>
          <p className="entry-description">
            A private space for the account credentials and recovery codes you choose to store.
            Sign in to access your vault.
          </p>
          <div className="entry-trust-points" aria-label="Vault capabilities">
            <span><b>◇</b> PRIVATE ACCOUNT RECORDS</span>
            <span><b>⌁</b> AUTHENTICATED ACCESS</span>
            <span><b>▣</b> ENCRYPTED STORAGE</span>
          </div>
          <AuthPanel />
          <footer>
            Private Account Vault · <Link href="/security">Security &amp; Transparency</Link> ·{" "}
            <Link href="/security/research">Research Library</Link> · <Link href="/support">Research Fund</Link>
          </footer>
        </section>
      </div>
    </main>
  );
}
