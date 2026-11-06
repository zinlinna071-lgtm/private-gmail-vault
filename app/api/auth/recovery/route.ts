import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
import { decryptPendingRecoveryCode, encryptPendingRecoveryCode } from "@/lib/auth/recovery-encryption";
import { authEmailForLoginId, createRecoveryCode, hashRecoveryCode, isSameOriginRequest, normalizeLoginId, validatePassword, verifyRecoveryCode } from "@/lib/auth/vault";

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
  if (!isSameOriginRequest(request)) {
    return noStoreJson({ error: "Invalid request origin." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const loginId = normalizeLoginId(String(body.loginId ?? ""));
    if (!await allowAuthAttempt(request, "recovery", loginId, 5)) {
      return noStoreJson({ error: "Too many recovery attempts. Try again in 15 minutes." }, { status: 429 });
    }

    const recoveryCode = String(body.recoveryCode ?? "");
    const newPassword = String(body.newPassword ?? "");
    validatePassword(newPassword);

    const admin = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await admin.from("vault_profiles")
      .select("user_id,recovery_code_hash,recovery_code_salt,pending_recovery_code_hash,pending_recovery_code_salt,pending_recovery_code_ciphertext,pending_recovery_code_iv,pending_recovery_code_auth_tag,pending_recovery_code_expires_at")
      .eq("login_id", loginId).maybeSingle();

    if (profileError || !profile || !verifyRecoveryCode(recoveryCode, profile.recovery_code_hash, profile.recovery_code_salt)) {
      return noStoreJson({ error: "Login ID or Recovery Code is incorrect." }, { status: 401 });
    }

    const pendingIsValid = Boolean(
      profile.pending_recovery_code_hash &&
      profile.pending_recovery_code_salt &&
      profile.pending_recovery_code_ciphertext &&
      profile.pending_recovery_code_iv &&
      profile.pending_recovery_code_auth_tag &&
      profile.pending_recovery_code_expires_at &&
      new Date(profile.pending_recovery_code_expires_at).getTime() > Date.now()
    );

    // If the previous response was lost, the same old code + current Master
    // Password retrieves the exact same pending code without resetting again.
    if (pendingIsValid) {
      const { error: signInError } = await signIn(loginId, newPassword);
      if (signInError) {
        return noStoreJson({ error: "The Recovery Code is pending. Enter the current Master Password to retrieve it safely." }, { status: 401 });
      }
      const code = decryptPendingRecoveryCode({
        ciphertext: profile.pending_recovery_code_ciphertext!,
        iv: profile.pending_recovery_code_iv!,
        authTag: profile.pending_recovery_code_auth_tag!
      });
      return noStoreJson({ success: true, signedIn: true, recoveryCode: code, requiresAcknowledgement: true });
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
      return noStoreJson({ error: "Recovery protection is not ready. Contact support before retrying." }, { status: 503 });
    }
    if (claimed !== true) {
      return noStoreJson({ error: "A recovery attempt is already in progress, or this Recovery Code has already been used. Please wait and try again." }, { status: 409 });
    }

    let recoveryFinished = false;
    try {
      const { error: passwordError } = await admin.auth.admin.updateUserById(profile.user_id, { password: newPassword });
      if (passwordError) {
        return noStoreJson({ error: "Password reset failed. Your existing Recovery Code remains valid." }, { status: 500 });
      }

      const nextRecoveryCode = createRecoveryCode();
      const { hash, salt } = hashRecoveryCode(nextRecoveryCode);
      const encrypted = encryptPendingRecoveryCode(nextRecoveryCode);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data: finished, error: finishError } = await admin.rpc("finish_vault_recovery", {
        p_user_id: profile.user_id,
        p_claim_token: claimToken,
        p_pending_hash: hash,
        p_pending_salt: salt,
        p_ciphertext: encrypted.ciphertext,
        p_iv: encrypted.iv,
        p_auth_tag: encrypted.authTag,
        p_expires_at: expiresAt
      });

      if (finishError || finished !== true) {
        return noStoreJson({
          error: "The Master Password may have changed, but the Recovery Code is still pending. Retry with the existing Recovery Code and the new Master Password."
        }, { status: 503 });
      }
      recoveryFinished = true;

      const { error: signInError } = await signIn(loginId, newPassword);
      return noStoreJson({
        success: true,
        signedIn: !signInError,
        recoveryCode: nextRecoveryCode,
        // Acknowledgement requires an authenticated session. If automatic
        // sign-in fails, let the user sign in and retrieve the pending code.
        requiresAcknowledgement: !signInError
      });
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
    return noStoreJson({ error: message }, { status: 400 });
  }
}
