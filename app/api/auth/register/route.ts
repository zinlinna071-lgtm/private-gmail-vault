import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
import { encryptPendingRecoveryCode } from "@/lib/auth/recovery-encryption";
import { authEmailForLoginId, createRecoveryCode, hashRecoveryCode, isSameOriginRequest, normalizeLoginId, validatePassword } from "@/lib/auth/vault";

export const runtime = "nodejs";

async function signIn(loginId: string, password: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cookieStore = await cookies();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => items.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
    }
  });
  return supabase.auth.signInWithPassword({ email: authEmailForLoginId(loginId), password });
}

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
    const encrypted = encryptPendingRecoveryCode(recoveryCode);
    const pendingExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
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
      pending_recovery_code_hash: hash,
      pending_recovery_code_salt: salt,
      pending_recovery_code_ciphertext: encrypted.ciphertext,
      pending_recovery_code_iv: encrypted.iv,
      pending_recovery_code_auth_tag: encrypted.authTag,
      pending_recovery_code_expires_at: pendingExpiresAt
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      createdUserId = undefined;
      return NextResponse.json({ error: "Vault profile setup failed. Please try again." }, { status: 500 });
    }

    // If this response is lost, a later successful sign-in can retrieve the
    // same encrypted pending code until it is explicitly acknowledged.
    const { error: signInError } = await signIn(loginId, password);
    return NextResponse.json({
      success: true,
      signedIn: !signInError,
      recoveryCode,
      requiresAcknowledgement: !signInError
    });
  } catch (error) {
    if (createdUserId) {
      try { await createSupabaseAdminClient().auth.admin.deleteUser(createdUserId); } catch {}
    }
    const message = error instanceof Error ? error.message : "Unable to create account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
