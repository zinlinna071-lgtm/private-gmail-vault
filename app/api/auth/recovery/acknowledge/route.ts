import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/auth/vault";

export const runtime = "nodejs";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  return NextResponse.json(body, { ...init, headers });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return noStoreJson({ error: "Invalid request origin." }, { status: 403 });
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
      return noStoreJson({ error: "Sign in before confirming that you saved the Recovery Code." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();
    const { data: acknowledged, error } = await admin.rpc("acknowledge_vault_recovery_code", {
      p_user_id: user.id
    });

    if (error) {
      return noStoreJson({ error: "Could not confirm the Recovery Code. Keep the displayed code and try again." }, { status: 503 });
    }
    if (acknowledged !== true) {
      return noStoreJson({ error: "The pending Recovery Code has expired or was already confirmed. Do not discard your saved code until you verify sign-in and recovery." }, { status: 409 });
    }

    return noStoreJson({ success: true });
  } catch {
    return noStoreJson({ error: "Unable to confirm the Recovery Code." }, { status: 500 });
  }
}
