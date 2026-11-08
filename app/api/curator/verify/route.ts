import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  CURATOR_CHALLENGE_COOKIE, CURATOR_CLAIM_COOKIE, CURATOR_CLAIM_TTL_SECONDS,
  CURATOR_SESSION_COOKIE, createOpaqueToken, hashOpaqueToken
} from "@/lib/auth/curator-claim";
import { isSameOriginRequest } from "@/lib/auth/vault";
import { allowAuthAttempt, AuthRateLimitError } from "@/lib/auth/rate-limit";
import { isValidCuratorSolution } from "@/lib/auth/curator-puzzle";

export const runtime = "nodejs";

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" }
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return noStoreJson({ error: "Invalid request origin." }, 403);
  }

  const store = await cookies();
  const session = store.get(CURATOR_SESSION_COOKIE)?.value;
  const challenge = store.get(CURATOR_CHALLENGE_COOKIE)?.value;
  if (!session || !challenge) {
    return noStoreJson({ error: "Start a fresh Curator challenge first." }, 428);
  }

  try {
    if (!await allowAuthAttempt(request, "curator", hashOpaqueToken(session), 5)) {
      return noStoreJson({ error: "Too many puzzle attempts. Please try again later." }, 429);
    }
  } catch (error) {
    const code = error instanceof AuthRateLimitError ? error.code : "CURATOR_RATE_LIMIT_UNAVAILABLE";
    console.error("[curator] rate limit unavailable", { code });
    return noStoreJson({ error: "Puzzle verification is temporarily unavailable." }, 503);
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return noStoreJson({ error: "Invalid puzzle response." }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return noStoreJson({ error: "Invalid puzzle response." }, 400);
  }
  const input = body as Record<string, unknown>;
  if (!isValidCuratorSolution(input.found, input.order)) {
    return noStoreJson({ error: "The archive is not aligned yet. Review the marks and try again." }, 422);
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: challengeConsumed, error: challengeError } = await admin.rpc("consume_curator_challenge", {
      p_challenge_hash: hashOpaqueToken(challenge),
      p_session_hash: hashOpaqueToken(session)
    });
    if (challengeError) {
      console.error("[curator] challenge consume failed", { errorType: challengeError.name });
      return noStoreJson({ error: "Challenge verification is temporarily unavailable. Start again shortly." }, 503);
    }
    if (challengeConsumed !== true) {
      return noStoreJson({ error: "This challenge has expired or was already used. Start a fresh challenge." }, 403);
    }

    const claim = createOpaqueToken();
    const expiresAt = new Date(Date.now() + CURATOR_CLAIM_TTL_SECONDS * 1000).toISOString();
    const { error } = await admin.from("curator_registration_claims").insert({
      claim_hash: hashOpaqueToken(claim),
      session_hash: hashOpaqueToken(session),
      expires_at: expiresAt
    });
    if (error) {
      console.error("[curator] claim issuance failed", { errorType: error.name });
      return noStoreJson({ error: "The archive could not issue an access claim. Start a fresh challenge and try again." }, 503);
    }

    const response = noStoreJson({ success: true, message: "The Curator's Signal is verified. Continue to account creation." });
    response.cookies.set(CURATOR_CLAIM_COOKIE, claim, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "strict", path: "/", maxAge: CURATOR_CLAIM_TTL_SECONDS
    });
    response.cookies.set(CURATOR_CHALLENGE_COOKIE, "", {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "strict", path: "/api/curator", maxAge: 0
    });
    return response;
  } catch (error) {
    console.error("[curator] verification failed", { errorType: error instanceof Error ? error.name : "unknown" });
    return noStoreJson({ error: "The archive could not verify this challenge. Please try again." }, 503);
  }
}
