import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CURATOR_CHALLENGE_COOKIE, CURATOR_CHALLENGE_TTL_SECONDS, CURATOR_SESSION_COOKIE, createOpaqueToken } from "@/lib/auth/curator-claim";
import { isSameOriginRequest } from "@/lib/auth/vault";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const store = await cookies();
  const session = store.get(CURATOR_SESSION_COOKIE)?.value || createOpaqueToken();
  const challenge = createOpaqueToken();
  const response = NextResponse.json({ success: true, challenge: "curator-fourfold-v1" }, {
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" }
  });
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(CURATOR_SESSION_COOKIE, session, {
    httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 30 * 60
  });
  response.cookies.set(CURATOR_CHALLENGE_COOKIE, challenge, {
    httpOnly: true, secure, sameSite: "strict", path: "/api/curator", maxAge: CURATOR_CHALLENGE_TTL_SECONDS
  });
  return response;
}
