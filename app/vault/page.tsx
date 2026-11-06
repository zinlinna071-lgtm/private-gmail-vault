export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import GmailInbox from "./gmail-inbox";

export default async function VaultPage({ searchParams }: { searchParams: Promise<{ gmail_connected?: string; gmail_error?: string }> }) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("vault_profiles").select("login_id").eq("user_id", user.id).maybeSingle();
  const { data: connections } = await admin
    .from("gmail_connections")
    .select("id, email_address, display_name, connection_status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const activeConnection = connections?.some((connection) => connection.connection_status === "active");

  return (
    <main className="shell">
      <section className="hero">
        <div className="brand"><span className="brand-mark">V</span><span>PRIVATE GMAIL VAULT</span></div>
        <div className="eyebrow">PRIVATE VAULT SESSION</div>
        <h1>Welcome back<span>.</span></h1>
        <p className="intro">Signed in as <strong>{profile?.login_id ?? "Vault account"}</strong>. Your independent Vault authentication is active.</p>

        {params.gmail_connected === "1" && <p className="feedback success" role="status">Gmail account connected successfully.</p>}
        {params.gmail_error && <p className="feedback error" role="alert">Gmail connection could not be completed ({params.gmail_error.replaceAll("_", " ")}). Please try again or check the Google OAuth setup.</p>}
        <section className="notice" aria-labelledby="gmail-heading">
          <strong id="gmail-heading">Your Gmail connections</strong>
          {connections?.length ? (
            <ul>
              {connections.map((connection) => (
                <li key={connection.id}>
                  <strong>{connection.email_address}</strong>
                  {connection.display_name && <span> · {connection.display_name}</span>}
                  <p>Status: {connection.connection_status.replaceAll("_", " ")}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No Gmail account is connected yet. Connect an account using Google's official authorization page.</p>
          )}
          <Link className="primary-button" href="/api/gmail/connect">Connect a Gmail account</Link>
          <p>Permission requested: Gmail read-only access. This app never asks for your Gmail password.</p>
        </section>

        {activeConnection && <GmailInbox />}

        <div className="notice">
          <strong>Security truth</strong>
          <p>Your Google refresh token is encrypted before storage. Gmail access is read-only. Google may revoke access or request identity verification at any time; only Google can approve that verification.</p>
        </div>
        <form action="/api/auth/logout" method="post"><button className="primary-button" type="submit">Sign out</button></form>
        <footer>Private Gmail Vault <span>•</span> Keep your Recovery Code somewhere separate and secure</footer>
      </section>
    </main>
  );
}
