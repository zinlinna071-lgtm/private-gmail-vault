import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Privileged database client. Use only after authenticating the request with
 * Supabase Auth, and always scope every read/write by the authenticated user_id.
 * Never import this module into a Client Component or return secret columns.
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase server credentials are not configured.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}
