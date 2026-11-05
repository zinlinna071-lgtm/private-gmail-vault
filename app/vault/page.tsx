"use server";

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function VaultPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  // The profile table intentionally denies direct authenticated-role access.
  const { data: profile } = await createSupabaseAdminClient()
    .from("vault_profiles").select("login_id").eq("user_id", user.id).maybeSingle();

  return (
    <main className="shell">
      <section className="hero">
        <div className="brand"><span className="brand-mark">V</span><span>PRIVATE GMAIL VAULT</span></div>
        <div className="eyebrow">PRIVATE VAULT SESSION</div>
        <h1>Welcome back<span>.</span></h1>
        <p className="intro">Signed in as <strong>{profile?.login_id ?? "Vault account"}</strong>. Your independent Vault authentication is active.</p>
        <div className="notice">
          <strong>Gmail connections are the next stage</strong>
          <p>This session is your independent Vault identity. Gmail accounts will appear here after the Google OAuth connection flow is implemented and authorized.</p>
        </div>
        <form action="/api/auth/logout" method="post"><button className="primary-button" type="submit">Sign out</button></form>
        <footer>Private Gmail Vault <span>•</span> Keep your Recovery Code somewhere separate and secure</footer>
      </section>
    </main>
  );
}
