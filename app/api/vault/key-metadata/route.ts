import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/auth/vault";
import { readBoundedJson } from "@/lib/auth/bounded-json";
import { isJsonContentType } from "@/lib/auth/content-type";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function isCanonicalBase64(value: string, byteLength: number) {
  if (!BASE64.test(value)) return false;
  const decoded = Buffer.from(value, "base64");
  return decoded.byteLength === byteLength && decoded.toString("base64") === value;
}

const metadataSchema = z.object({
  profileId: z.union([z.literal(1), z.literal(2)]),
  salt: z.string().length(24).refine(value => isCanonicalBase64(value, 16)),
  wrappedKeyEnvelope: z.object({
    version: z.literal(1),
    algorithm: z.literal("AES-256-GCM"),
    iv: z.string().length(16).refine(value => isCanonicalBase64(value, 12)),
    wrappedKey: z.string().length(64).refine(value => isCanonicalBase64(value, 48))
  }).strict()
}).strict();

const columns = "client_crypto_version,client_kdf_algorithm,client_kdf_profile,client_kdf_salt,client_wrapped_dek_iv,client_wrapped_dek,client_key_created_at";

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

function toPublicMetadata(row: Record<string, unknown> | null) {
  if (!row || row.client_crypto_version === null) return null;
  return {
    version: row.client_crypto_version,
    kdfAlgorithm: row.client_kdf_algorithm,
    profileId: row.client_kdf_profile,
    salt: row.client_kdf_salt,
    wrappedKeyEnvelope: {
      version: 1,
      algorithm: "AES-256-GCM",
      iv: row.client_wrapped_dek_iv,
      wrappedKey: row.client_wrapped_dek
    },
    createdAt: row.client_key_created_at
  };
}

/**
 * Stores only public KDF metadata and an encrypted DEK envelope.
 * No password, KEK, raw DEK, or plaintext record is accepted by this route.
 * This endpoint remains dormant until the metadata migration is applied and
 * the client-side unlock + ciphertext-only CRUD rollout is approved.
 */
export async function GET() {
  try {
    const user = await getUser();
    if (!user) return response({ error: "Please sign in again." }, 401);

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("vault_profiles")
      .select(columns)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return response({ error: "Vault profile not found." }, 404);
    return response({ metadata: toPublicMetadata(data) });
  } catch {
    return response({ error: "Could not load Vault key metadata." }, 500);
  }
}

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) return response({ error: "Invalid request origin." }, 403);
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return response({ error: "Unsupported content type." }, 415);
  }

  try {
    const user = await getUser();
    if (!user) return response({ error: "Please sign in again." }, 401);

    const body = await readBoundedJson(request, 2_048);
    if (!body.ok) {
      return body.reason === "too_large"
        ? response({ error: "Request is too large." }, 413)
        : response({ error: "Invalid JSON request." }, 400);
    }
    const parsed = metadataSchema.safeParse(body.value);
    if (!parsed.success) return response({ error: "Invalid Vault key metadata." }, 400);

    const admin = createSupabaseAdminClient();
    const { profileId, salt, wrappedKeyEnvelope } = parsed.data;
    const { data, error } = await admin.from("vault_profiles")
      .update({
        client_crypto_version: 1,
        client_kdf_algorithm: "argon2id-v1.3",
        client_kdf_profile: profileId,
        client_kdf_salt: salt,
        client_wrapped_dek_iv: wrappedKeyEnvelope.iv,
        client_wrapped_dek: wrappedKeyEnvelope.wrappedKey,
        client_key_created_at: new Date().toISOString()
      })
      .eq("user_id", user.id)
      .is("client_crypto_version", null)
      .select(columns)
      .maybeSingle();

    if (error) throw error;
    if (data) return response({ metadata: toPublicMetadata(data) }, 201);

    const { data: existing, error: readError } = await admin.from("vault_profiles")
      .select("client_crypto_version")
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw readError;
    if (!existing) return response({ error: "Vault profile not found." }, 404);
    return response({ error: "Vault key metadata is already initialized. It cannot be replaced through this endpoint." }, 409);
  } catch {
    return response({ error: "Could not initialize Vault key metadata." }, 500);
  }
}
