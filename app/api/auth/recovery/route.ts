import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
import { authEmailForLoginId, createRecoveryCode, hashRecoveryCode, normalizeLoginId, validatePassword, verifyRecoveryCode } from "@/lib/auth/vault";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const loginId = normalizeLoginId(String(body.loginId ?? ""));
    if (!await allowAuthAttempt(request, "recovery", loginId, 5)) {
      return NextResponse.json({ error: "Too many recovery attempts. Try again in 15 minutes." }, { status: 429 });
    }
    const recoveryCode = String(body.recoveryCode ?? "");
    const newPassword = String(body.newPassword ?? "");
    validatePassword(newPassword);

    const admin = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await admin.from("vault_profiles")
      .select("user_id,recovery_code_hash,recovery_code_salt")
      .eq("login_id", loginId).maybeSingle();

    if (profileError || !profile || !verifyRecoveryCode(recoveryCode, profile.recovery_code_hash, profile.recovery_code_salt)) {
      return NextResponse.json({ error: "Login ID or Recovery Code is incorrect." }, { status: 401 });
    }

    const { error: passwordError } = await admin.auth.admin.updateUserById(profile.user_id, { password: newPassword });
    if (passwordError) return NextResponse.json({ error: "Password reset failed. Your existing Recovery Code remains valid." }, { status: 500 });

    const nextRecoveryCode = createRecoveryCode();
    const { hash, salt } = hashRecoveryCode(nextRecoveryCode);
    const { error: rotateError } = await admin.from("vault_profiles").update({
      recovery_code_hash: hash, recovery_code_salt: salt
    }).eq("user_id", profile.user_id);
    if (rotateError) return NextResponse.json({ error: "Password reset succeeded, but Recovery Code renewal failed. Keep your existing code safe and sign in with the new password." }, { status: 500 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => items.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      }
    });
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: authEmailForLoginId(loginId), password: newPassword
    });
    return NextResponse.json({ success: true, signedIn: !signInError, recoveryCode: nextRecoveryCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to recover account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
