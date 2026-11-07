import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptVaultItem, encryptVaultItem } from "@/lib/vault/item-encryption";
import { isSameOriginRequest } from "@/lib/auth/vault";
import { readBoundedJson } from "@/lib/auth/bounded-json";
import { isJsonContentType } from "@/lib/auth/content-type";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const entrySchema = z.object({
  accountName: z.string().trim().min(1).max(100),
  username: z.string().max(254).default(""),
  password: z.string().max(4096).default(""),
  backupCodes: z.string().max(12000).default("")
}).strict();

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", "Pragma": "no-cache" }
  });
}

function logVaultFailure(operation: "GET" | "POST", stage: string, error: unknown) {
  const candidate = error && typeof error === "object" && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;
  const code = typeof candidate === "string" && /^[A-Z0-9_-]{1,32}$/.test(candidate)
    ? candidate
    : undefined;

  // Never log request bodies, user identifiers, credentials, ciphertext, keys, or raw errors.
  console.error(`[vault] ${operation} failed`, { stage, ...(code ? { code } : {}) });
}

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  let stage = "auth";
  try {
    const user = await getUser();
    if (!user) return response({ error: "Please sign in again." }, 401);

    stage = "admin_client";
    const admin = createSupabaseAdminClient();

    stage = "select";
    const { data, error } = await admin.from("vault_items")
      .select("id,ciphertext,iv,auth_tag,created_at,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) throw error;

    stage = "decrypt";
    const items = (data ?? []).map((row) => ({
      id: row.id,
      ...entrySchema.parse(JSON.parse(decryptVaultItem({
        ciphertext: row.ciphertext,
        iv: row.iv,
        authTag: row.auth_tag
      }, user.id, row.id))),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    return response({ items });
  } catch (error) {
    logVaultFailure("GET", stage, error);
    return response({ error: "Could not open the Vault. Check the server encryption setup." }, 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return response({ error: "Invalid request origin." }, 403);
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return response({ error: "Unsupported content type." }, 415);
  }

  let stage = "auth";
  try {
    const user = await getUser();
    if (!user) return response({ error: "Please sign in again." }, 401);

    stage = "body";
    const body = await readBoundedJson(request, 20_000);
    if (!body.ok) {
      return body.reason === "too_large"
        ? response({ error: "Request is too large." }, 413)
        : response({ error: "Invalid JSON request." }, 400);
    }
    const parsed = entrySchema.safeParse(body.value);
    if (!parsed.success) return response({ error: "Please check the account details and try again." }, 400);

    stage = "encrypt";
    const id = randomUUID();
    const encrypted = encryptVaultItem(JSON.stringify(parsed.data), user.id, id);

    stage = "admin_client";
    const admin = createSupabaseAdminClient();

    stage = "insert";
    const { data, error } = await admin.from("vault_items").insert({
      id,
      user_id: user.id,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag
    }).select("id,created_at,updated_at").single();
    if (error) throw error;
    return response({ item: { id, ...parsed.data, createdAt: data.created_at, updatedAt: data.updated_at } }, 201);
  } catch (error) {
    logVaultFailure("POST", stage, error);
    return response({ error: "Could not save this account. Check the server encryption setup." }, 500);
  }
}
