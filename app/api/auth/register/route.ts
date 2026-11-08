import { NextResponse } from "next/server";
import { readBoundedJson } from "@/lib/auth/bounded-json";
import { isJsonContentType } from "@/lib/auth/content-type";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allowAuthAttempt, AuthRateLimitError } from "@/lib/auth/rate-limit";
import { encryptPendingRecoveryCode } from "@/lib/auth/recovery-encryption";
import { authEmailForLoginId, createRecoveryCode, hashRecoveryCode, isSameOriginRequest, normalizeLoginId, validatePassword } from "@/lib/auth/vault";
import { CURATOR_CLAIM_COOKIE, CURATOR_SESSION_COOKIE, hashOpaqueToken } from "@/lib/auth/curator-claim";

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

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  return NextResponse.json(body, { ...init, headers });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return noStoreJson({ error: "Invalid request origin." }, { status: 403 });
  let createdUserId: string | undefined;
  let failureStage = "request-validation";
  try {
    if (!isJsonContentType(request.headers.get("content-type"))) {
      return noStoreJson({ error: "Content-Type must be application/json." }, { status: 415 });
    }
    const parsedBody = await readBoundedJson(request, 8 * 1024);
    if (!parsedBody.ok) {
      return noStoreJson(
        { error: parsedBody.reason === "too_large" ? "Request body is too large." : "Invalid JSON request." },
        { status: parsedBody.reason === "too_large" ? 413 : 400 }
      );
    }
    if (!parsedBody.value || typeof parsedBody.value !== "object" || Array.isArray(parsedBody.value)) {
      return noStoreJson({ error: "Invalid JSON request." }, { status: 400 });
    }
    const body = parsedBody.value as Record<string, unknown>;
    if (body.responsibilityAccepted !== true) {
      return noStoreJson({ error: "Please review and accept the Vault responsibility notice before creating an account." }, { status: 428 });
    }
    let loginId: string;
    try {
      loginId = normalizeLoginId(String(body.loginId ?? ""));
    } catch {
      return noStoreJson({ error: "Invalid Login ID." }, { status: 400 });
    }
    failureStage = "rate-limit";
    if (!await allowAuthAttempt(request, "register", loginId, 5)) {
      return noStoreJson({ error: "Too many account creation attempts. Try again later." }, { status: 429 });
    }
    const password = String(body.password ?? "");
    try {
      validatePassword(password);
    } catch {
      return noStoreJson({ error: "Master Password must be 12–128 characters." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const curatorClaim = cookieStore.get(CURATOR_CLAIM_COOKIE)?.value;
    const curatorSession = cookieStore.get(CURATOR_SESSION_COOKIE)?.value;
    if (!curatorClaim || !curatorSession) {
      return noStoreJson({ error: "Complete The Curator's Signal before creating a Secondary account." }, { status: 428 });
    }
    failureStage = "curator-claim-consume";
    const claimAdmin = createSupabaseAdminClient();
    const { data: claimConsumed, error: claimError } = await claimAdmin.rpc("consume_curator_registration_claim", {
      p_claim_hash: hashOpaqueToken(curatorClaim),
      p_session_hash: hashOpaqueToken(curatorSession)
    });
    if (claimError || claimConsumed !== true) {
      return noStoreJson({ error: "Your Curator claim is invalid, expired, or already used. Solve the challenge again." }, { status: 403 });
    }
    cookieStore.delete(CURATOR_CLAIM_COOKIE);

    failureStage = "recovery-code-generation";
    const recoveryCode = createRecoveryCode();
    const { hash, salt } = hashRecoveryCode(recoveryCode);
    const encrypted = encryptPendingRecoveryCode(recoveryCode);
    // Initial Recovery Code remains pending until the user confirms it was saved.
    // No expiry avoids permanently losing recovery if the first response is missed.
    const pendingExpiresAt = null;
    failureStage = "supabase-admin-account-create";
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: authEmailForLoginId(loginId), password, email_confirm: true,
      user_metadata: { vault_login_id: loginId }
    });
    if (error || !data.user) {
      return noStoreJson({ error: "That Login ID may already be in use, or the account could not be created." }, { status: 400 });
    }
    createdUserId = data.user.id;

    failureStage = "vault-profile-create";
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
      return noStoreJson({ error: "Vault profile setup failed. Please try again." }, { status: 500 });
    }

    // If this response is lost, a later successful sign-in can retrieve the
    // same encrypted pending code until it is explicitly acknowledged.
    failureStage = "supabase-auth";
    const { error: signInError } = await signIn(loginId, password);
    return noStoreJson({
      success: true,
      signedIn: !signInError,
      recoveryCode,
      requiresAcknowledgement: !signInError
    });
  } catch (error) {
    if (createdUserId) {
      try { await createSupabaseAdminClient().auth.admin.deleteUser(createdUserId); } catch {}
    }
    const diagnosticCode = error instanceof AuthRateLimitError ? error.code
      : failureStage === "supabase-admin-account-create" ? "AUTH_ADMIN_ACCOUNT_CREATE_FAILED"
      : failureStage === "vault-profile-create" ? "VAULT_PROFILE_CREATE_FAILED"
      : failureStage === "supabase-auth" ? "AUTH_PROVIDER_UNAVAILABLE"
      : "AUTH_REGISTER_UNEXPECTED_FAILURE";
    console.error("[vault-auth] registration failed", { stage: failureStage, code: diagnosticCode, errorType: error instanceof Error ? error.name : "unknown" });
    return noStoreJson({ error: "Unable to create the Vault account. Please try again.", code: diagnosticCode }, { status: 500 });
  }
}
