import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptRefreshToken } from "@/lib/gmail/token-encryption";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

type GmailHeader = { name?: string; value?: string };
type GmailMessage = { id?: string; threadId?: string; snippet?: string; internalDate?: string; payload?: { headers?: GmailHeader[] } };

const MAILBOX_LABELS = new Set(["INBOX", "SENT", "STARRED", "DRAFT", "SPAM", "TRASH", "IMPORTANT", "UNREAD", "ALL"]);

function header(headers: GmailHeader[] | undefined, name: string) {
  return headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "authentication_required" }, { status: 401 });

  const accountId = request.nextUrl.searchParams.get("accountId") ?? "";
  if (accountId && !/^[0-9a-f-]{36}$/i.test(accountId)) {
    return NextResponse.json({ error: "invalid_gmail_account" }, { status: 400 });
  }
  const rawQuery = request.nextUrl.searchParams.get("q") ?? "";
  const query = rawQuery.trim();
  const mailbox = (request.nextUrl.searchParams.get("label") ?? "INBOX").toUpperCase();
  if (query.length > 200 || /[\u0000-\u001f\u007f]/.test(query)) {
    return NextResponse.json({ error: "invalid_search_query" }, { status: 400 });
  }
  if (!MAILBOX_LABELS.has(mailbox)) {
    return NextResponse.json({ error: "invalid_mailbox" }, { status: 400 });
  }

  try {
    const allowed = await allowAuthAttempt(request, "gmail_inbox", user.id, 30);
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
    let connectionQuery = admin
      .from("gmail_connections")
      .select("id,email_address,google_subject,refresh_token_ciphertext,refresh_token_iv,refresh_token_auth_tag,encryption_key_version,encryption_format_version,connection_status,granted_scopes")
      .eq("user_id", user.id)
      .eq("connection_status", "active");
    if (accountId) connectionQuery = connectionQuery.eq("id", accountId);
    const { data: connection, error: connectionError } = await connectionQuery
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connectionError || !connection) {
      return NextResponse.json({ error: "gmail_connection_not_found" }, { status: 404 });
    }
    if (!connection.granted_scopes?.includes("https://www.googleapis.com/auth/gmail.readonly")) {
      return NextResponse.json({ error: "gmail_readonly_scope_missing" }, { status: 403 });
    }

    const refreshToken = decryptRefreshToken({
      ciphertext: connection.refresh_token_ciphertext,
      iv: connection.refresh_token_iv,
      authTag: connection.refresh_token_auth_tag,
      keyVersion: connection.encryption_key_version,
      formatVersion: connection.encryption_format_version
    }, { userId: user.id, googleSubject: connection.google_subject });
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: "google_oauth_not_configured" }, { status: 503 });
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token"
      }),
      cache: "no-store"
    });
    if (!tokenResponse.ok) {
      const failed = await admin.from("gmail_connections")
        .update({ connection_status: "reauthorization_required" })
        .eq("id", connection.id).eq("user_id", user.id);
      void failed;
      return NextResponse.json({ error: "google_reauthorization_required" }, { status: 401 });
    }
    const tokenPayload: unknown = await tokenResponse.json();
    if (!tokenPayload || typeof tokenPayload !== "object" || typeof (tokenPayload as Record<string, unknown>).access_token !== "string") {
      return NextResponse.json({ error: "google_token_response_invalid" }, { status: 502 });
    }
    const accessToken = (tokenPayload as { access_token: string }).access_token;

    const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    listUrl.searchParams.set("maxResults", "20");
    if (query) listUrl.searchParams.set("q", query);
    if (mailbox !== "ALL") listUrl.searchParams.set("labelIds", mailbox);
    if (mailbox === "SPAM" || mailbox === "TRASH") listUrl.searchParams.set("includeSpamTrash", "true");
    const listResponse = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });
    if (!listResponse.ok) {
      return NextResponse.json({ error: "gmail_messages_unavailable" }, { status: listResponse.status === 403 ? 403 : 502 });
    }
    const listPayload: unknown = await listResponse.json();
    const ids = listPayload && typeof listPayload === "object" && Array.isArray((listPayload as { messages?: unknown }).messages)
      ? (listPayload as { messages: Array<{ id?: string }> }).messages
      : [];
    const messages = await Promise.all(ids.slice(0, 20).filter((item) => typeof item.id === "string").map(async (item) => {
      const messageResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id!)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store"
      });
      if (!messageResponse.ok) return null;
      const message = await messageResponse.json() as GmailMessage;
      return {
        id: message.id ?? item.id!,
        threadId: message.threadId ?? "",
        from: header(message.payload?.headers, "From"),
        subject: header(message.payload?.headers, "Subject") || "(no subject)",
        date: header(message.payload?.headers, "Date"),
        snippet: (message.snippet ?? "").slice(0, 500)
      };
    }));

    await admin.from("gmail_connections")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", connection.id).eq("user_id", user.id);

    return NextResponse.json({
      account: connection.email_address,
      query,
      mailbox,
      messages: messages.filter((message): message is NonNullable<typeof message> => message !== null)
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return NextResponse.json({ error: "gmail_inbox_request_failed" }, { status: 500 });
  }
}
