import AuthPanel from "./auth-panel";

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="brand"><span className="brand-mark">V</span><span>PRIVATE GMAIL VAULT</span></div>
        <div className="eyebrow">YOUR INDEPENDENT ACCESS KEY</div>
        <h1>One Vault.<br /><span>Any device.</span></h1>
        <p className="intro">
          Sign in to your private Vault from a new browser, even if your old phone or SIM is gone. Your Vault account is separate from every Gmail account you connect.
        </p>
        <AuthPanel />
        <div className="notice">
          <strong>Security truth</strong>
          <p>The Vault can preserve authorized Gmail access while Google tokens remain valid. If Google revokes an authorization or requires identity verification, only Google can approve that verification. This service cannot bypass Google's security checks.</p>
        </div>
        <footer>Private Gmail Vault <span>•</span> Never enter your Gmail password here</footer>
      </section>
    </main>
  );
}
