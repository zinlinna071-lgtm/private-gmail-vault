import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Privileged database client. Use only on the server, after authenticating
 * requests where appropriate, and scope every user-data query by user_id.
 * Never import this module into a Client Component or return secret columns.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) throw new Error("Supabase server credentials are not configured.");

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
  });
}
