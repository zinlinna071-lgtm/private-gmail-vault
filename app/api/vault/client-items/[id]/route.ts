import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSameOriginRequest } from "@/lib/auth/vault";
import { readBoundedJson } from "@/lib/auth/bounded-json";
import { isJsonContentType } from "@/lib/auth/content-type";
import { vaultCiphertextUpdateSchema, vaultRecordIdSchema } from "@/lib/vault/server-envelope-schema";

export const runtime = "nodejs";

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

/** Update an existing client-encrypted envelope; legacy rows are never upgraded here. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return response({ error: "Invalid request origin." }, 403);
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return response({ error: "Unsupported content type." }, 415);
  }

  try {
    const user = await getUser();
    if (!user) return response({ error: "Please sign in again." }, 401);

    const { id } = await params;
    if (!vaultRecordIdSchema.safeParse(id).success) return response({ error: "Record not found." }, 404);

    const body = await readBoundedJson(request, 30_000);
    if (!body.ok) {
      return body.reason === "too_large"
        ? response({ error: "Request is too large." }, 413)
        : response({ error: "Invalid JSON request." }, 400);
    }
    const parsed = vaultCiphertextUpdateSchema.safeParse(body.value);
    if (!parsed.success) return response({ error: "Invalid encrypted Vault record." }, 400);

    const admin = createSupabaseAdminClient();
    if (!await hasClientKeyMetadata(admin, user.id)) {
      return response({ error: "Client-side Vault encryption is not initialized." }, 409);
    }

    const { envelope } = parsed.data;
    const { data, error } = await admin.from("vault_items").update({
      ciphertext: envelope.ciphertext,
      iv: envelope.iv,
      auth_tag: envelope.authTag
    }).eq("id", id)
      .eq("user_id", user.id)
      .eq("encryption_scheme", CLIENT_SCHEME)
      .select("id,created_at,updated_at")
      .maybeSingle();

    if (error) throw error;
    if (!data) return response({ error: "Encrypted record not found." }, 404);
    return response({
      item: { id, envelope, createdAt: data.created_at, updatedAt: data.updated_at }
    });
  } catch {
    return response({ error: "Could not update the encrypted Vault record." }, 500);
  }
}

/** Delete is owner-scoped and cannot target a legacy row through this route. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return response({ error: "Invalid request origin." }, 403);

  try {
    const user = await getUser();
    if (!user) return response({ error: "Please sign in again." }, 401);

    const { id } = await params;
    if (!vaultRecordIdSchema.safeParse(id).success) return response({ error: "Record not found." }, 404);

    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("vault_items").delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("encryption_scheme", CLIENT_SCHEME)
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) return response({ error: "Encrypted record not found." }, 404);
    return response({ success: true });
  } catch {
    return response({ error: "Could not delete the encrypted Vault record." }, 500);
  }
}
