import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allowAuthAttempt, AuthRateLimitError } from "@/lib/auth/rate-limit";
import {
  CURATOR_CHALLENGE_COOKIE, CURATOR_CHALLENGE_TTL_SECONDS,
  CURATOR_SESSION_COOKIE, createOpaqueToken, hashOpaqueToken
} from "@/lib/auth/curator-claim";

export const runtime = "nodejs";

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" }
  });
}

export async function GET(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return noStoreJson({ error: "Invalid request origin." }, 403);
  }

  try {
    const store = await cookies();
    const session = store.get(CURATOR_SESSION_COOKIE)?.value || createOpaqueToken();
    if (!await allowAuthAttempt(request, "curator-challenge", hashOpaqueToken(session), 10)) {
      return noStoreJson({ error: "Too many challenge requests. Please try again later." }, 429);
    }

    const challenge = createOpaqueToken();
    const expiresAt = new Date(Date.now() + CURATOR_CHALLENGE_TTL_SECONDS * 1000).toISOString();
    const admin = createSupabaseAdminClient();
    const { error } = await admin.from("curator_challenges").insert({
      challenge_hash: hashOpaqueToken(challenge),
      session_hash: hashOpaqueToken(session),
      expires_at: expiresAt
    });
    if (error) {
      console.error("[curator] challenge issuance failed", { errorType: error.name });
      return noStoreJson({ error: "The archive challenge could not be started. Please try again." }, 503);
    }

    const response = noStoreJson({ success: true, challenge: "curator-fourfold-v1" });
    const secure = process.env.NODE_ENV === "production";
    response.cookies.set(CURATOR_SESSION_COOKIE, session, {
      httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 30 * 60
    });
    response.cookies.set(CURATOR_CHALLENGE_COOKIE, challenge, {
      httpOnly: true, secure, sameSite: "strict", path: "/api/curator", maxAge: CURATOR_CHALLENGE_TTL_SECONDS
    });
    return response;
  } catch (error) {
    const code = error instanceof AuthRateLimitError ? error.code : "CURATOR_CHALLENGE_UNAVAILABLE";
    console.error("[curator] challenge bootstrap failed", { code });
    return noStoreJson({ error: "The archive challenge is temporarily unavailable." }, 503);
  }
}
