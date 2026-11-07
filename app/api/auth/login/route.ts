import { NextResponse } from "next/server";
import { readBoundedJson } from "@/lib/auth/bounded-json";
import { isJsonContentType } from "@/lib/auth/content-type";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
import { decryptPendingRecoveryCode } from "@/lib/auth/recovery-encryption";
import { authEmailForLoginId, isSameOriginRequest, normalizeLoginId } from "@/lib/auth/vault";

export const runtime = "nodejs";

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Pragma", "no-cache");
  return NextResponse.json(body, { ...init, headers });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return noStoreJson({ error: "Invalid request origin." }, { status: 403 });
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
    let loginId: string;
    try {
      loginId = normalizeLoginId(String(body.loginId ?? ""));
    } catch {
      return noStoreJson({ error: "Invalid Login ID." }, { status: 400 });
    }
    failureStage = "rate-limit";
    if (!await allowAuthAttempt(request, "login", loginId, 10)) {
      return noStoreJson({ error: "Too many sign-in attempts. Try again in 15 minutes." }, { status: 429 });
    }
    const password = String(body.password ?? "");
    failureStage = "supabase-public-config";
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Supabase public configuration is missing.");

    failureStage = "supabase-auth";
    const cookieStore = await cookies();
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => items.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      }
    });
    const { error } = await supabase.auth.signInWithPassword({ email: authEmailForLoginId(loginId), password });
    if (error) return noStoreJson({ error: "Login ID or Master Password is incorrect." }, { status: 401 });

    // Registration may have succeeded even if its original response was lost.
    // Return the same code after password authentication, never generate a
    // second code, and keep the active recovery hash empty until acknowledgement.
    failureStage = "vault-profile-lookup";
    const admin = createSupabaseAdminClient();
    const { data: profile, error: profileError } = await admin.from("vault_profiles")
      .select("pending_recovery_code_hash,pending_recovery_code_salt,pending_recovery_code_ciphertext,pending_recovery_code_iv,pending_recovery_code_auth_tag,pending_recovery_code_expires_at")
      .eq("login_id", loginId).maybeSingle();
    if (profileError) {
      return noStoreJson({ error: "Signed in, but Vault recovery status could not be checked. Keep this session open and retry." }, { status: 503 });
    }

    const pendingIsValid = Boolean(
      profile?.pending_recovery_code_hash &&
      profile.pending_recovery_code_salt &&
      profile.pending_recovery_code_ciphertext &&
      profile.pending_recovery_code_iv &&
      profile.pending_recovery_code_auth_tag &&
      (!profile.pending_recovery_code_expires_at ||
        new Date(profile.pending_recovery_code_expires_at).getTime() > Date.now())
    );
    if (pendingIsValid) {
      failureStage = "pending-recovery-decryption";
      const recoveryCode = decryptPendingRecoveryCode({
        ciphertext: profile!.pending_recovery_code_ciphertext!,
        iv: profile!.pending_recovery_code_iv!,
        authTag: profile!.pending_recovery_code_auth_tag!
      });
      return noStoreJson({ success: true, recoveryCode, requiresAcknowledgement: true });
    }

    return noStoreJson({ success: true });
  } catch (error) {
    const diagnosticCode = failureStage === "rate-limit" ? "AUTH_RATE_LIMIT_UNAVAILABLE"
      : failureStage === "supabase-public-config" ? "AUTH_PUBLIC_CONFIG_MISSING"
      : failureStage === "supabase-auth" ? "AUTH_PROVIDER_UNAVAILABLE"
      : failureStage === "vault-profile-lookup" ? "VAULT_PROFILE_UNAVAILABLE"
      : failureStage === "pending-recovery-decryption" ? "RECOVERY_CODE_DECRYPTION_FAILED"
      : "AUTH_UNEXPECTED_FAILURE";
    // Log only the stage and error class. Never log Login IDs, passwords, cookies,
    // Recovery Codes, database values, or provider error messages.
    console.error("[vault-auth] sign-in failed", { stage: failureStage, code: diagnosticCode, errorType: error instanceof Error ? error.name : "unknown" });
    return noStoreJson({ error: "Unable to complete sign-in. Please try again.", code: diagnosticCode }, { status: 500 });
  }
}
