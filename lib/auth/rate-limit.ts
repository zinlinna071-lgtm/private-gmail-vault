import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export class AuthRateLimitError extends Error {
  constructor(readonly code: "AUTH_ADMIN_CONFIG_MISSING" | "AUTH_RATE_LIMIT_RPC_UNAVAILABLE") {
    super(code);
    this.name = "AuthRateLimitError";
  }
}

export async function allowAuthAttempt(request: Request, action: string, loginId: string, limit: number) {
  // Only trust headers set by the hosting proxy. x-forwarded-for can be spoofed.
  const ip = request.headers.get("x-real-ip")
    ?? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";

  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    throw new AuthRateLimitError("AUTH_ADMIN_CONFIG_MISSING");
  }

  const buckets = [
    { key: `${action}|ip|${ip}`, max: 50 },
    { key: `${action}|ip-login|${ip}|${loginId}`, max: limit }
  ];
  for (const item of buckets) {
    const bucket = createHash("sha256").update(item.key).digest("hex");
    const { data, error } = await admin.rpc("consume_vault_auth_attempt", {
      p_bucket_hash: bucket,
      p_max_attempts: item.max,
      p_window_seconds: 900
    });
    if (error) throw new AuthRateLimitError("AUTH_RATE_LIMIT_RPC_UNAVAILABLE");
    if (data !== true) return false;
  }
  return true;
}
