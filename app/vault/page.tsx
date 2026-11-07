export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import VaultManager from "./vault-manager";\nimport SignOutControl from "./sign-out-control";

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
    <main className="shell">
      <section className="hero vault-hero">
        <div className="brand"><span className="brand-mark">V</span><span>PRIVATE ACCOUNT VAULT</span></div>
        <div className="vault-heading">
          <div>
            <div className="eyebrow">YOUR PRIVATE VAULT</div>
            <h1>Your accounts<span>.</span></h1>
            <p className="intro">Signed in as {profile?.login_id ?? "Vault account"}.</p>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="secondary-button" type="submit">Sign out</button>
          </form>
        </div>
        <VaultManager />
        <footer>Private Account Vault</footer>
      </section>
    </main>
  );
}
