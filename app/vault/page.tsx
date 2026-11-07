export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import VaultManager from "./vault-manager";
import SignOutControl from "./sign-out-control";

export default async function VaultPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("vault_profiles")
    .select("login_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="museum-shell">
      <div className="museum-ambient" aria-hidden="true" />
      <header className="museum-header">
        <Link href="/vault" className="museum-brand" aria-label="Private Digital Vault home">
          <span className="museum-brand-mark" aria-hidden="true">V</span>
          <span className="museum-brand-name">PRIVATE DIGITAL VAULT<small>THE PERSONAL COLLECTION</small></span>
        </Link>

        <div className="museum-header-center">
          <span className="museum-status-light" />
          <span>PRIVATE COLLECTION</span>
        </div>

        <div className="museum-header-actions">
          <Link className="museum-research-link" href="/security">Security research</Link>
          <span className="museum-account-label" title={profile?.login_id ?? "Vault account"}>
            {profile?.login_id ?? "Vault account"}
          </span>
          <SignOutControl />
        </div>
      </header>

      <div className="museum-main">
        <section className="museum-welcome" aria-labelledby="museum-welcome-title">
          <div className="museum-welcome-copy">
            <span className="museum-section-kicker">A PRIVATE PLACE FOR WHAT MATTERS</span>
            <h1 id="museum-welcome-title">Your digital world.<br /><em>Quietly protected.</em></h1>
            <p>
              A single, considered space for the records you choose to keep.
              Explore your collection without navigating a maze of categories.
            </p>
          </div>
          <div className="museum-welcome-emblem" aria-label="Private collection emblem">
            <div className="museum-emblem-orbit museum-emblem-orbit-one" />
            <div className="museum-emblem-orbit museum-emblem-orbit-two" />
            <div className="museum-emblem-core"><span>V</span></div>
            <span className="museum-emblem-caption">PRIVATE BY DESIGN</span>
          </div>
        </section>

        <VaultManager />

        <section className="museum-research-wing" aria-labelledby="museum-wing-title">
          <div className="museum-wing-art" aria-hidden="true">
            <span className="museum-wing-ring museum-wing-ring-one" />
            <span className="museum-wing-ring museum-wing-ring-two" />
            <span className="museum-wing-core"><span>R</span></span>
          </div>
          <div className="museum-wing-copy">
            <span className="museum-section-kicker">A SEPARATE PLACE WITHIN THE COLLECTION</span>
            <h2 id="museum-wing-title">Private Security Lab</h2>
            <p>
              A dedicated research wing for authorized security testing, isolated test assets,
              and evidence-led investigations. Its private test workspace will be connected
              separately from the public research pages.
            </p>
            <div className="museum-wing-status"><span /> PRIVATE WORKSPACE · ACCESS GATE REQUIRED</div>
          </div>
          <Link className="museum-wing-public-link" href="/security/research">Visit public research library <span aria-hidden="true">↗</span></Link>
        </section>

        <footer className="museum-footer">
          <span>PRIVATE DIGITAL VAULT</span>
          <span>YOUR COLLECTION IS PRIVATE · PUBLIC RESEARCH IS READ ONLY</span>
          <span>© {new Date().getFullYear()}</span>
        </footer>
      </div>
    </main>
  );
}
