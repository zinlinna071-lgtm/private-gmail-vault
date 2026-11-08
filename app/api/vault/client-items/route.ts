import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/auth/vault";
import { readBoundedJson } from "@/lib/auth/bounded-json";
import { isJsonContentType } from "@/lib/auth/content-type";
import { vaultCiphertextCreateSchema } from "@/lib/vault/server-envelope-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLIENT_SCHEME = "client-aes-256-gcm-v1";

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" }
  });
}

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function hasClientKeyMetadata(admin: ReturnType<typeof createSupabaseAdminClient>, userId: string) {
  const { data, error } = await admin.from("vault_profiles")
    .select("client_crypto_version")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.client_crypto_version === 1;
}

function toEnvelope(row: { ciphertext: string; iv: string; auth_tag: string }) {
  return {
    version: 1 as const,
    algorithm: "AES-256-GCM" as const,
    iv: row.iv,
    ciphertext: row.ciphertext,
    authTag: row.auth_tag
  };
}

/**
 * Ciphertext-only API. This route never imports a server decryptor and never
 * accepts account names, usernames, passwords, backup codes, or key material.
 * It remains dormant until the client metadata and record migrations exist.
 */
export async function GET() {
  try {
    const user = await getUser();
    if (!user) return response({ error: "Please sign in again." }, 401);

    const admin = createSupabaseAdminClient();
    if (!await hasClientKeyMetadata(admin, user.id)) {
      return response({ error: "Client-side Vault encryption is not initialized." }, 409);
    }

    const { data, error } = await admin.from("vault_items")
      .select("id,ciphertext,iv,auth_tag,created_at,updated_at")
      .eq("user_id", user.id)
      .eq("encryption_scheme", CLIENT_SCHEME)
      .order("updated_at", { ascending: false });
    if (error) throw error;

    const items = (data ?? []).map(row => ({
      id: row.id,
      envelope: toEnvelope(row),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    return response({ items });
  } catch {
    return response({ error: "Could not load encrypted Vault records." }, 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return response({ error: "Invalid request origin." }, 403);
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return response({ error: "Unsupported content type." }, 415);
  }

  try {
    const user = await getUser();
    if (!user) return response({ error: "Please sign in again." }, 401);

    const body = await readBoundedJson(request, 30_000);
    if (!body.ok) {
      return body.reason === "too_large"
        ? response({ error: "Request is too large." }, 413)
        : response({ error: "Invalid JSON request." }, 400);
    }

    const parsed = vaultCiphertextCreateSchema.safeParse(body.value);
    if (!parsed.success) return response({ error: "Invalid encrypted Vault record." }, 400);

    const admin = createSupabaseAdminClient();
    if (!await hasClientKeyMetadata(admin, user.id)) {
      return response({ error: "Initialize client-side Vault encryption before saving records." }, 409);
    }

    const { id, envelope } = parsed.data;
    const { data, error } = await admin.rpc("create_client_vault_item_with_quota", {
      p_user_id: user.id,
      p_id: id,
      p_ciphertext: envelope.ciphertext,
      p_iv: envelope.iv,
      p_auth_tag: envelope.authTag
    });
    if (error) {
      if (error.code === "23514" && error.message === "VAULT_SECONDARY_LIMIT_REACHED") {
        return response({ error: "A Secondary Vault can store up to four records." }, 409);
      }
      throw error;
    }

    const created = Array.isArray(data) ? data[0] : null;
    if (!created || created.id !== id) throw new Error("Encrypted Vault insert returned no row.");
    return response({
      item: { id, envelope, createdAt: created.created_at, updatedAt: created.updated_at }
    }, 201);
  } catch {
    return response({ error: "Could not save the encrypted Vault record." }, 500);
  }
}
