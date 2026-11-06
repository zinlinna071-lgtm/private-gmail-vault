import { createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function stateSignature(state: string, userId: string) {
  const key = process.env.GMAIL_OAUTH_STATE_HMAC_KEY || process.env.VAULT_ENCRYPTION_KEY || "";
  if (!/^[a-fA-F0-9]{64}$/.test(key)) throw new Error("OAuth state signing is not configured.");
  return createHmac("sha256", Buffer.from(key, "hex"))
    .update(`gmail-oauth:${state}:${userId}`)
    .digest("hex");
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url));

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL("/vault?gmail_error=oauth_not_configured", request.url));
  }

  let callback: URL;
  try {
    callback = new URL(redirectUri);
    if (callback.protocol !== "https:" && process.env.NODE_ENV === "production") throw new Error("HTTPS required");
    if (callback.pathname !== "/api/gmail/callback") throw new Error("Unexpected redirect path");
  } catch {
    return NextResponse.redirect(new URL("/vault?gmail_error=invalid_redirect_uri", request.url));
  }

  const state = randomBytes(32).toString("base64url");
  const signedState = `${state}.${stateSignature(state, user.id)}`;
  const authorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", callback.toString());
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", "openid email profile https://www.googleapis.com/auth/gmail.readonly");
  authorizationUrl.searchParams.set("access_type", "offline");
  authorizationUrl.searchParams.set("prompt", "select_account consent");
  authorizationUrl.searchParams.set("include_granted_scopes", "true");
  authorizationUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizationUrl);
  response.cookies.set("gmail_oauth_state", signedState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/gmail/callback",
    maxAge: 600
  });
  return response;
}
