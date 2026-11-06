import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/auth/vault";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase client settings are not configured.");

    const cookieStore = await cookies();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => items.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      }
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Sign in before confirming that you saved the Recovery Code." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data: acknowledged, error } = await admin.rpc("acknowledge_vault_recovery_code", {
      p_user_id: user.id
    });

    if (error) {
      return NextResponse.json({ error: "Could not confirm the Recovery Code. Keep the displayed code and try again." }, { status: 503 });
    }
    if (acknowledged !== true) {
      return NextResponse.json({ error: "The pending Recovery Code has expired or was already confirmed. Do not discard your saved code until you verify sign-in and recovery." }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unable to confirm the Recovery Code." }, { status: 500 });
  }
}
