import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptRefreshToken } from "@/lib/gmail/token-encryption";

export const dynamic = "force-dynamic";

function validStateSignature(state: string, signature: string, userId: string) {
  const key = process.env.VAULT_ENCRYPTION_KEY ?? "";
  if (!/^[a-fA-F0-9]{64}$/.test(key) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", Buffer.from(key, "hex"))
    .update(`gmail-oauth:${state}:${userId}`)
    .digest();
  const actual = Buffer.from(signature, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function vaultRedirect(request: NextRequest, result: string) {
  const response = NextResponse.redirect(new URL(`/vault?gmail_${result}`, request.url));
  response.cookies.delete("gmail_oauth_state");
  return response;
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return vaultRedirect(request, "error=sign_in_required");

  const state = request.nextUrl.searchParams.get("state") ?? "";
  const savedState = request.cookies.get("gmail_oauth_state")?.value ?? "";
  const separator = savedState.indexOf(".");
  const savedNonce = separator > 0 ? savedState.slice(0, separator) : "";
  const savedSignature = separator > 0 ? savedState.slice(separator + 1) : "";
  if (!state || state !== savedNonce || !validStateSignature(savedNonce, savedSignature, user.id)) {
    return vaultRedirect(request, "error=invalid_oauth_state");
  }

  const googleError = request.nextUrl.searchParams.get("error");
  if (googleError) return vaultRedirect(request, "error=authorization_denied");

  const code = request.nextUrl.searchParams.get("code");
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!code || !clientId || !clientSecret || !redirectUri) {
    return vaultRedirect(request, "error=oauth_not_configured");
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      }),
      cache: "no-store"
    });
    if (!tokenResponse.ok) return vaultRedirect(request, "error=token_exchange_failed");
    const tokens: unknown = await tokenResponse.json();
    if (!tokens || typeof tokens !== "object") return vaultRedirect(request, "error=invalid_token_response");
    const tokenData = tokens as Record<string, unknown>;
    const accessToken = typeof tokenData.access_token === "string" ? tokenData.access_token : "";
    if (!accessToken) return vaultRedirect(request, "error=missing_access_token");

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });
    if (!profileResponse.ok) return vaultRedirect(request, "error=google_profile_failed");
    const profile: unknown = await profileResponse.json();
    if (!profile || typeof profile !== "object") return vaultRedirect(request, "error=invalid_google_profile");
    const googleProfile = profile as Record<string, unknown>;
    const googleSubject = typeof googleProfile.sub === "string" ? googleProfile.sub : "";
    const emailAddress = typeof googleProfile.email === "string" ? googleProfile.email.toLowerCase() : "";
    if (!googleSubject || !emailAddress || googleProfile.email_verified !== true) {
      return vaultRedirect(request, "error=unverified_google_account");
    }

    const admin = createSupabaseAdminClient();
    const { data: existing, error: lookupError } = await admin
      .from("gmail_connections")
      .select("refresh_token_ciphertext, refresh_token_iv, refresh_token_auth_tag")
      .eq("user_id", user.id)
      .eq("google_subject", googleSubject)
      .maybeSingle();
    if (lookupError) return vaultRedirect(request, "error=connection_lookup_failed");

    const newRefreshToken = typeof tokenData.refresh_token === "string" ? tokenData.refresh_token : "";
    const encrypted = newRefreshToken
      ? encryptRefreshToken(newRefreshToken)
      : existing?.refresh_token_ciphertext
        ? {
            ciphertext: existing.refresh_token_ciphertext,
            iv: existing.refresh_token_iv,
            authTag: existing.refresh_token_auth_tag,
            keyVersion: 1
          }
        : null;
    if (!encrypted) return vaultRedirect(request, "error=refresh_token_missing");

    const scopeString = typeof tokenData.scope === "string" ? tokenData.scope : "";
    const grantedScopes = scopeString
      ? scopeString.split(" ").filter(Boolean)
      : ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.readonly"];
    if (!grantedScopes.includes("https://www.googleapis.com/auth/gmail.readonly")) {
      return vaultRedirect(request, "error=gmail_readonly_scope_missing");
    }
    const { data: connection, error: saveError } = await admin
      .from("gmail_connections")
      .upsert({
        user_id: user.id,
        google_subject: googleSubject,
        email_address: emailAddress,
        display_name: typeof googleProfile.name === "string" ? googleProfile.name.slice(0, 200) : null,
        granted_scopes: grantedScopes,
        refresh_token_ciphertext: encrypted.ciphertext,
        refresh_token_iv: encrypted.iv,
        refresh_token_auth_tag: encrypted.authTag,
        encryption_key_version: encrypted.keyVersion,
        connection_status: "active",
        last_used_at: new Date().toISOString()
      }, { onConflict: "user_id,google_subject" })
      .select("id")
      .single();
    if (saveError || !connection) return vaultRedirect(request, "error=connection_save_failed");

    await admin.from("vault_audit_events").insert({
      user_id: user.id,
      event_type: "gmail_oauth_connected",
      outcome: "success",
      connection_id: connection.id,
      metadata: { provider: "google", scopes: grantedScopes }
    });

    return vaultRedirect(request, "connected=1");
  } catch {
    return vaultRedirect(request, "error=connection_failed");
  }
}
