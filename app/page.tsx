export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="brand"><span className="brand-mark">V</span><span>PRIVATE GMAIL VAULT</span></div>
        <div className="eyebrow">YOUR PRIVATE ACCESS WORKSPACE</div>
        <h1>Your email access,<br /><span>thoughtfully protected.</span></h1>
        <p className="intro">
          A private place to manage your connected Gmail accounts, with security and recovery designed in from the beginning.
        </p>
        <div className="status"><span className="status-dot" /> Foundation setup in progress</div>
        <div className="notice">
          <strong>Security first</strong>
          <p>Google sign-in and verification rules still apply. This vault will use Google-authorized access; it will never ask you to store your Gmail password here or promise to bypass Google security checks.</p>
        </div>
        <footer>Private Gmail Vault <span>•</span> Built with security as the default</footer>
      </section>
    </main>
  );
}