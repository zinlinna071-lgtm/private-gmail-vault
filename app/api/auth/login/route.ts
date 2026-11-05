import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
import { authEmailForLoginId, normalizeLoginId } from "@/lib/auth/vault";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const loginId = normalizeLoginId(String(body.loginId ?? ""));
    if (!await allowAuthAttempt(request, "login", loginId, 10)) {
      return NextResponse.json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, { status: 429 });
    }
    const password = String(body.password ?? "");
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase public configuration is missing.");

    const cookieStore = await cookies();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => items.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      }
    });
    const { error } = await supabase.auth.signInWithPassword({ email: authEmailForLoginId(loginId), password });
    if (error) return NextResponse.json({ error: "Login ID or Master Password is incorrect." }, { status: 401 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sign in.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
