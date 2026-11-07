import Link from "next/link";

const samples = [
  { name: "Google Account", detail: "sample.user@example.test", updated: "DEMO RECORD" },
  { name: "GitHub", detail: "demo-developer", updated: "DEMO RECORD" },
  { name: "Cloudflare", detail: "preview@example.test", updated: "DEMO RECORD" }
];

export const metadata = {
  title: "Vault Preview | Private Account Vault",
  robots: { index: false, follow: false, noarchive: true }
};

export default function VaultPreviewPage() {
  return (
    <main className="museum-shell">
      <div className="museum-ambient" aria-hidden="true" />
      <header className="museum-header">
        <Link href="/" className="museum-brand" aria-label="Return to sign in">
          <span className="museum-brand-mark" aria-hidden="true">V</span>
          <span className="museum-brand-name">PRIVATE DIGITAL VAULT<small>INTERFACE PREVIEW</small></span>
        </Link>
        <div className="museum-header-center">
          <span className="museum-status-light" />
          <span>READ-ONLY DEMO</span>
        </div>
        <div className="museum-header-actions">
          <Link className="museum-research-link" href="/">Return to sign in</Link>
        </div>
      </header>

      <div className="museum-main">
        <div role="note" style={{ border: "1px solid rgba(79, 211, 177, .35)", background: "rgba(20, 110, 91, .12)", borderRadius: 14, padding: "14px 18px", marginBottom: 28 }}>
          <strong style={{ display: "block", letterSpacing: ".12em", fontSize: 12 }}>DEMO MODE · NO AUTHENTICATION</strong>
          <span style={{ display: "block", marginTop: 5, opacity: .8, fontSize: 13 }}>This is a read-only visual preview with fictional sample records. It is not connected to your private Vault or its APIs.</span>
        </div>

        <section className="museum-welcome" aria-labelledby="preview-title">
          <div className="museum-welcome-copy">
            <span className="museum-section-kicker">VAULT / PREVIEW COLLECTION</span>
            <h1 id="preview-title">Your accounts.<br /><em>Under your control.</em></h1>
            <p>Explore the Vault layout without entering a Login ID or Master Password.</p>
          </div>
          <div className="museum-welcome-emblem" aria-label="Demo collection emblem">
            <div className="museum-emblem-orbit museum-emblem-orbit-one" />
            <div className="museum-emblem-orbit museum-emblem-orbit-two" />
            <div className="museum-emblem-core"><span>V</span></div>
            <span className="museum-emblem-caption">SAMPLE DATA ONLY</span>
          </div>
        </section>

        <section className="museum-collection" aria-labelledby="preview-collection-title">
          <div className="museum-collection-heading">
            <div>
              <span className="museum-section-kicker">THE ARCHIVE / SAMPLE RECORDS</span>
              <h2 id="preview-collection-title">The collection<span>.</span></h2>
              <p>Fictional entries to preview the collection presentation.</p>
            </div>
            <div className="museum-collection-count">
              <strong>03</strong>
              <span>SAMPLE RECORDS</span>
            </div>
          </div>
          <div className="museum-asset-grid" aria-label="Sample account records">
            {samples.map((item, index) => (
              <article className={"museum-asset-card museum-tone-" + index} key={item.name}>
                <div className="museum-artwork">
                  <div className="museum-artwork-topline">
                    <span>DEMO No. {String(index + 1).padStart(2, "0")}</span>
                    <span className="museum-artwork-lock" aria-hidden="true">◇</span>
                  </div>
                  <div className="museum-artwork-orbit museum-orbit-one" aria-hidden="true" />
                  <div className="museum-artwork-orbit museum-orbit-two" aria-hidden="true" />
                  <div className="museum-artwork-mark" aria-hidden="true"><span>{item.name.charAt(0)}</span></div>
                  <div className="museum-artwork-bottomline">
                    <span>FICTIONAL ACCOUNT</span>
                    <span>PREVIEW ONLY</span>
                  </div>
                </div>
                <div className="museum-asset-caption">
                  <div className="museum-asset-title-row"><h3>{item.name}</h3><span aria-hidden="true">◇</span></div>
                  <p>{item.detail}</p>
                  <div className="museum-asset-meta"><span>{item.updated}</span><span>READ ONLY</span></div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className="museum-footer">
          <span>PRIVATE DIGITAL VAULT</span>
          <span>DEMO DATA · NO PRIVATE RECORDS ACCESSED</span>
          <span><Link href="/">EXIT PREVIEW</Link></span>
        </footer>
      </div>
    </main>
  );
}
