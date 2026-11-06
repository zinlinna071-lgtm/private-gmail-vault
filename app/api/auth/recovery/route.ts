import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
import { authEmailForLoginId, createRecoveryCode, hashRecoveryCode, isSameOriginRequest, normalizeLoginId, validatePassword, verifyRecoveryCode } from "@/lib/auth/vault";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

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

    const claimToken = randomUUID();
    const { data: claimed, error: claimError } = await admin.rpc("claim_vault_recovery", {
      p_user_id: profile.user_id,
      p_expected_hash: profile.recovery_code_hash,
      p_expected_salt: profile.recovery_code_salt,
      p_claim_token: claimToken,
      p_lease_seconds: 600
    });

    if (claimError) {
      return NextResponse.json({ error: "Recovery protection is not ready. Contact support before retrying." }, { status: 503 });
    }
    if (claimed !== true) {
      return NextResponse.json({ error: "A recovery attempt is already in progress, or this Recovery Code has already been used. Please wait and try again." }, { status: 409 });
    }

    let recoveryFinished = false;
    try {
      const { error: passwordError } = await admin.auth.admin.updateUserById(profile.user_id, { password: newPassword });
      if (passwordError) {
        return NextResponse.json({ error: "Password reset failed. Your existing Recovery Code remains valid." }, { status: 500 });
      }

      const nextRecoveryCode = createRecoveryCode();
      const { hash, salt } = hashRecoveryCode(nextRecoveryCode);
      const { data: finished, error: finishError } = await admin.rpc("finish_vault_recovery", {
        p_user_id: profile.user_id,
        p_claim_token: claimToken,
        p_new_hash: hash,
        p_new_salt: salt
      });

      if (finishError || finished !== true) {
        return NextResponse.json({
          error: "Your password may have been reset, but the Recovery Code was not rotated. Sign in with your new password if possible; otherwise retry recovery with the existing code."
        }, { status: 503 });
      }
      recoveryFinished = true;

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
    } finally {
      if (!recoveryFinished) {
        await admin.rpc("release_vault_recovery", {
          p_user_id: profile.user_id,
          p_claim_token: claimToken
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to recover account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
