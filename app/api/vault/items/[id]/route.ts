import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptVaultItem } from "@/lib/vault/item-encryption";

export const runtime = "nodejs";

const entrySchema = z.object({
  accountName: z.string().trim().min(1).max(100),
  username: z.string().max(254).default(""),
  password: z.string().max(4096).default(""),
  backupCodes: z.string().max(12000).default(""),
  notes: z.string().max(4000).default("")
}).strict();

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", "Pragma": "no-cache" }
  });
}

async function getUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser();
    if (!user) return response({ error: "Please sign in again." }, 401);
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return response({ error: "Account not found." }, 404);
    }
    const parsed = entrySchema.safeParse(await request.json());
    if (!parsed.success) return response({ error: "Please check the account details and try again." }, 400);
    const encrypted = encryptVaultItem(JSON.stringify(parsed.data), user.id, id);
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("vault_items").update({
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag
    }).eq("id", id).eq("user_id", user.id).select("id,created_at,updated_at").maybeSingle();
    if (error) throw error;
    if (!data) return response({ error: "Account not found." }, 404);
    return response({ item: { id, ...parsed.data, createdAt: data.created_at, updatedAt: data.updated_at } });
  } catch {
    return response({ error: "Could not update this account." }, 500);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUser();
    if (!user) return response({ error: "Please sign in again." }, 401);
    const { id } = await params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return response({ error: "Account not found." }, 404);
    }
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from("vault_items").delete()
      .eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return response({ error: "Account not found." }, 404);
    return response({ success: true });
  } catch {
    return response({ error: "Could not delete this account." }, 500);
  }
}
