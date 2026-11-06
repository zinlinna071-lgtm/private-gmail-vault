import Link from "next/link";
import AuthPanel from "./auth-panel";

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="brand"><span className="brand-mark">V</span><span>PRIVATE ACCOUNT VAULT</span></div>
        <div className="eyebrow">ONE PRIVATE PLACE</div>
        <h1>Your accounts.<br /><span>One secure vault.</span></h1>
        <p className="intro">Keep your account passwords and backup codes together in one private place.</p>
        <AuthPanel />
        <footer>Private Account Vault · <Link href="/security" style={{ color: "#9bb9f5", textDecoration: "none" }}>Security & Transparency</Link> · <Link href="/support" style={{ color: "#9bb9f5", textDecoration: "none" }}>Research Fund</Link></footer>
      </section>
    </main>
  );
}
