import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { authEmailForLoginId, createRecoveryCode, hashRecoveryCode, normalizeLoginId, validatePassword } from "@/lib/auth/vault";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let createdUserId: string | undefined;
  try {
    const body = await request.json();
    const loginId = normalizeLoginId(String(body.loginId ?? ""));
    const password = String(body.password ?? "");
    validatePassword(password);

    const recoveryCode = createRecoveryCode();
    const { hash, salt } = hashRecoveryCode(recoveryCode);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: authEmailForLoginId(loginId),
      password,
      email_confirm: true,
      user_metadata: { vault_login_id: loginId }
    });
    if (error || !data.user) {
      return NextResponse.json({ error: error?.message ?? "Account could not be created." }, { status: 400 });
    }
    createdUserId = data.user.id;

    const { error: profileError } = await admin.from("vault_profiles").insert({
      user_id: data.user.id,
      display_name: loginId,
      login_id: loginId,
      recovery_code_hash: hash,
      recovery_code_salt: salt
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
