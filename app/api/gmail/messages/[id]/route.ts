import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptRefreshToken } from "@/lib/gmail/token-encryption";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

type Part = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: Part[];
};
type GmailMessage = {
  id?: string;
  threadId?: string;
  snippet?: string;
  internalDate?: string;
  payload?: { mimeType?: string; headers?: Array<{ name?: string; value?: string }>; body?: Part["body"]; parts?: Part[] };
};

function decodeBody(data: string) {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}
function findBody(part: Part | undefined, mimeType: string): string | null {
  if (!part) return null;
  if (part.mimeType?.toLowerCase() === mimeType && part.body?.data) return decodeBody(part.body.data);
  for (const child of part.parts ?? []) {
    const found = findBody(child, mimeType);
    if (found) return found;
  }
  return null;
}
function htmlToText(html: string) {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/(p|div|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}
function getHeader(headers: Array<{ name?: string; value?: string }> | undefined, name: string) {
  return headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[a-zA-Z0-9_-]{1,200}$/.test(id)) {
    return NextResponse.json({ error: "invalid_message_id" }, { status: 400 });
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  try {
    const allowed = await allowAuthAttempt(_request, "gmail_message_detail", user.id, 60);
    if (!allowed) {
      return NextResponse.json(
        { error: "rate_limit_exceeded" },
        { status: 429, headers: { "Retry-After": "900", "Cache-Control": "no-store" } }
      );
    }
  } catch {
    return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: connection, error } = await admin
      .from("gmail_connections")
      .select("id,email_address,refresh_token_ciphertext,refresh_token_iv,refresh_token_auth_tag,connection_status,granted_scopes")
      .eq("user_id", user.id)
      .eq("connection_status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !connection) return NextResponse.json({ error: "gmail_connection_not_found" }, { status: 404 });
    if (!connection.granted_scopes?.includes("https://www.googleapis.com/auth/gmail.readonly")) {
      return NextResponse.json({ error: "gmail_readonly_scope_missing" }, { status: 403 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return NextResponse.json({ error: "google_oauth_not_configured" }, { status: 503 });
    const refreshToken = decryptRefreshToken({
      ciphertext: connection.refresh_token_ciphertext,
      iv: connection.refresh_token_iv,
      authTag: connection.refresh_token_auth_tag
    });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
      cache: "no-store"
    });
    if (!tokenResponse.ok) {
      await admin.from("gmail_connections").update({ connection_status: "reauthorization_required" }).eq("id", connection.id).eq("user_id", user.id);
      return NextResponse.json({ error: "google_reauthorization_required" }, { status: 401 });
    }
    const tokenPayload: unknown = await tokenResponse.json();
    if (!tokenPayload || typeof tokenPayload !== "object" || typeof (tokenPayload as Record<string, unknown>).access_token !== "string") {
      return NextResponse.json({ error: "google_token_response_invalid" }, { status: 502 });
    }
    const accessToken = (tokenPayload as { access_token: string }).access_token;
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });
    if (!response.ok) return NextResponse.json({ error: response.status === 404 ? "gmail_message_not_found" : "gmail_message_unavailable" }, { status: response.status === 404 ? 404 : response.status === 403 ? 403 : 502 });

    const message = await response.json() as GmailMessage;
    const plain = findBody(message.payload, "text/plain");
    const html = plain ? null : findBody(message.payload, "text/html");
    const bodyText = (plain ?? (html ? htmlToText(html) : message.snippet ?? "")).slice(0, 100_000);
    const attachments: Array<{ filename: string; mimeType: string; size: number }> = [];
    const collect = (part: Part | undefined) => {
      if (!part) return;
      if (part.filename) attachments.push({ filename: part.filename.slice(0, 255), mimeType: part.mimeType ?? "application/octet-stream", size: part.body?.size ?? 0 });
      for (const child of part.parts ?? []) collect(child);
    };
    collect(message.payload);
    return NextResponse.json({
      id: message.id ?? id,
      threadId: message.threadId ?? "",
      account: connection.email_address,
      from: getHeader(message.payload?.headers, "From"),
      to: getHeader(message.payload?.headers, "To"),
      cc: getHeader(message.payload?.headers, "Cc"),
      subject: getHeader(message.payload?.headers, "Subject") || "(no subject)",
      date: getHeader(message.payload?.headers, "Date"),
      bodyText,
      attachments
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return NextResponse.json({ error: "gmail_message_request_failed" }, { status: 500 });
  }
}
