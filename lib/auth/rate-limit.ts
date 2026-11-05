import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function allowAuthAttempt(request: Request, action: string, loginId: string, limit: number) {
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const admin = createSupabaseAdminClient();
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
    if (error) throw new Error("Authentication protection is not ready. Apply the latest Vault database migration.");
    if (data !== true) return false;
  }
  return true;
}
