import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/vault";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  // Do not report a successful logout if Supabase could not revoke the session.
  if (error) {
    return NextResponse.json(
      { error: "Could not complete sign out. Please retry." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.redirect(new URL("/", request.url), {
    status: 303,
    headers: { "Cache-Control": "no-store" }
  });
}
