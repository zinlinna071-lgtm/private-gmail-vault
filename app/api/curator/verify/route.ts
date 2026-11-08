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

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const store = await cookies();
  const session = store.get(CURATOR_SESSION_COOKIE)?.value;
  const challenge = store.get(CURATOR_CHALLENGE_COOKIE)?.value;
  if (!session || !challenge) {
    return NextResponse.json({ error: "Start a fresh Curator challenge first." }, { status: 428 });
  }

  try {
    if (!await allowAuthAttempt(request, "curator", hashOpaqueToken(session), 5)) {
      return NextResponse.json({ error: "Too many puzzle attempts. Please try again later." }, { status: 429 });
    }
  } catch (error) {
    const code = error instanceof AuthRateLimitError ? error.code : "CURATOR_RATE_LIMIT_UNAVAILABLE";
    console.error("[curator] rate limit unavailable", { code });
    return NextResponse.json({ error: "Puzzle verification is temporarily unavailable." }, { status: 503 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid puzzle response." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid puzzle response." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  if (!isValidCuratorSolution(input.found, input.order)) {
    return NextResponse.json({ error: "The archive is not aligned yet. Review the marks and try again." }, { status: 422 });
  }

  const claim = createOpaqueToken();
  const expiresAt = new Date(Date.now() + CURATOR_CLAIM_TTL_SECONDS * 1000).toISOString();
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("curator_registration_claims").insert({
    claim_hash: hashOpaqueToken(claim),
    session_hash: hashOpaqueToken(session),
    expires_at: expiresAt
  });
  if (error) {
    console.error("[curator] claim issuance failed", { errorType: error.name });
    return NextResponse.json({ error: "The archive could not issue an access claim. Please try again." }, { status: 503 });
  }

  const response = NextResponse.json({ success: true, message: "The Curator's Signal is verified. Continue to account creation." }, {
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" }
  });
  response.cookies.set(CURATOR_CLAIM_COOKIE, claim, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/", maxAge: CURATOR_CLAIM_TTL_SECONDS
  });
  response.cookies.set(CURATOR_CHALLENGE_COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "strict", path: "/api/curator", maxAge: 0
  });
  return response;
}
