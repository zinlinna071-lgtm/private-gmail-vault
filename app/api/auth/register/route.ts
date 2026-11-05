import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
import { authEmailForLoginId, createRecoveryCode, hashRecoveryCode, isSameOriginRequest, normalizeLoginId, validatePassword } from "@/lib/auth/vault";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  let createdUserId: string | undefined;
  try {
    const body = await request.json();
    const loginId = normalizeLoginId(String(body.loginId ?? ""));
    if (!await allowAuthAttempt(request, "register", loginId, 5)) {
      return NextResponse.json({ error: "Too many account creation attempts. Try again later." }, { status: 429 });
    }
    const password = String(body.password ?? "");
    validatePassword(password);

    const recoveryCode = createRecoveryCode();
    const { hash, salt } = hashRecoveryCode(recoveryCode);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: authEmailForLoginId(loginId), password, email_confirm: true,
      user_metadata: { vault_login_id: loginId }
    });
    if (error || !data.user) {
      return NextResponse.json({ error: "That Login ID may already be in use, or the account could not be created." }, { status: 400 });
    }
    createdUserId = data.user.id;

    const { error: profileError } = await admin.from("vault_profiles").insert({
      user_id: data.user.id, display_name: loginId, login_id: loginId,
      recovery_code_hash: hash, recovery_code_salt: salt
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      createdUserId = undefined;
      return NextResponse.json({ error: "Vault profile setup failed. Please try again." }, { status: 500 });
    }
    return NextResponse.json({ success: true, recoveryCode });
  } catch (error) {
    if (createdUserId) {
      try { await createSupabaseAdminClient().auth.admin.deleteUser(createdUserId); } catch {}
    }
    const message = error instanceof Error ? error.message : "Unable to create account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
