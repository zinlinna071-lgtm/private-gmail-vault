import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getUser: vi.fn(),
  encryptRefreshToken: vi.fn(),
  maybeSingle: vi.fn(),
  upsertSingle: vi.fn(),
  upsert: vi.fn(),
  auditInsert: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient
}));
vi.mock("@/lib/gmail/token-encryption", () => ({
  encryptRefreshToken: mocks.encryptRefreshToken
}));

import { GET } from "@/app/api/gmail/callback/route";

const originalEnv = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
  encryptionKey: process.env.VAULT_ENCRYPTION_KEY
};
const originalFetch = globalThis.fetch;

function signedState() {
  const nonce = "synthetic-success-state";
  const key = Buffer.from(process.env.VAULT_ENCRYPTION_KEY ?? "", "hex");
  const signature = createHmac("sha256", key)
    .update(`gmail-oauth:${nonce}:vault-user-1`)
    .digest("hex");
  return { nonce, cookie: `${nonce}.${signature}` };
}

function makeRequest(query: string, cookie: string) {
  return new NextRequest(`https://vault.example/api/gmail/callback${query}`, {
    headers: { cookie: `gmail_oauth_state=${cookie}` }
  });
}

describe("Gmail OAuth callback success persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "synthetic-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "synthetic-client-secret";
    process.env.GOOGLE_REDIRECT_URI = "https://vault.example/api/gmail/callback";
    process.env.VAULT_ENCRYPTION_KEY = "b".repeat(64);

    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser }
    });
    mocks.getUser.mockResolvedValue({ data: { user: { id: "vault-user-1" } } });
    mocks.encryptRefreshToken.mockReturnValue({
      ciphertext: "synthetic-ciphertext",
      iv: "synthetic-iv",
      authTag: "synthetic-auth-tag",
      keyVersion: 1,
      formatVersion: 1
    });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.upsertSingle.mockResolvedValue({ data: { id: "connection-1" }, error: null });
    mocks.auditInsert.mockResolvedValue({ error: null });

    const table = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mocks.maybeSingle,
      upsert: mocks.upsert.mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mocks.upsertSingle })
      }),
      insert: mocks.auditInsert
    };
    mocks.createSupabaseAdminClient.mockReturnValue({
      from: vi.fn((name: string) => name === "gmail_connections" ? table : { insert: mocks.auditInsert })
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnv.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalEnv.clientId;
    if (originalEnv.clientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = originalEnv.clientSecret;
    if (originalEnv.redirectUri === undefined) delete process.env.GOOGLE_REDIRECT_URI;
    else process.env.GOOGLE_REDIRECT_URI = originalEnv.redirectUri;
    if (originalEnv.encryptionKey === undefined) delete process.env.VAULT_ENCRYPTION_KEY;
    else process.env.VAULT_ENCRYPTION_KEY = originalEnv.encryptionKey;
  });

  it("uses granted scopes from the token response without calling tokeninfo", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url === "https://oauth2.googleapis.com/token") {
        return Response.json({
          access_token: "synthetic-access-token",
          refresh_token: "synthetic-refresh-token",
          scope: "openid email https://www.googleapis.com/auth/gmail.readonly"
        });
      }
      if (url === "https://www.googleapis.com/oauth2/v3/userinfo") {
        return Response.json({ sub: "google-subject-1", email: "Owner@Example.com", email_verified: true, name: "Vault Owner" });
      }
      throw new Error("Unexpected external request");
    }) as typeof fetch;

    const state = signedState();
    const response = await GET(makeRequest(`?state=${state.nonce}&code=synthetic-auth-code`, state.cookie));

    expect(response.headers.get("location")).toContain("/vault?gmail_connected=1");
    expect(calls).toHaveLength(2);
    expect(calls.some((call) => call.url.includes("tokeninfo"))).toBe(false);
    expect(calls[0].init?.method).toBe("POST");
    expect(String(calls[0].init?.body)).toContain("grant_type=authorization_code");
    expect(mocks.encryptRefreshToken).toHaveBeenCalledWith("synthetic-refresh-token", {
      userId: "vault-user-1",
      googleSubject: "google-subject-1"
    });
    expect(mocks.maybeSingle).toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      encryption_key_version: 1,
      encryption_format_version: 1,
      refresh_token_ciphertext: "synthetic-ciphertext"
    }), { onConflict: "user_id,google_subject" });
    expect(mocks.upsertSingle).toHaveBeenCalledWith();
  });

  it("preserves the existing encrypted envelope and both versions when Google omits a refresh token", async () => {
    const oldEnvelope = {
      refresh_token_ciphertext: "old-ciphertext",
      refresh_token_iv: "old-iv",
      refresh_token_auth_tag: "old-auth-tag",
      encryption_key_version: 7,
      encryption_format_version: 2
    };
    mocks.maybeSingle.mockResolvedValue({ data: oldEnvelope, error: null });
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url === "https://oauth2.googleapis.com/token") {
        return Response.json({
          access_token: "synthetic-access-token",
          scope: "openid email https://www.googleapis.com/auth/gmail.readonly"
        });
      }
      if (url === "https://www.googleapis.com/oauth2/v3/userinfo") {
        return Response.json({ sub: "google-subject-1", email: "owner@example.com", email_verified: true });
      }
      throw new Error("Unexpected external request");
    }) as typeof fetch;

    const state = signedState();
    const response = await GET(makeRequest(`?state=${state.nonce}&code=synthetic-auth-code`, state.cookie));

    expect(response.headers.get("location")).toContain("/vault?gmail_connected=1");
    expect(mocks.encryptRefreshToken).not.toHaveBeenCalled();
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      refresh_token_ciphertext: oldEnvelope.refresh_token_ciphertext,
      refresh_token_iv: oldEnvelope.refresh_token_iv,
      refresh_token_auth_tag: oldEnvelope.refresh_token_auth_tag,
      encryption_key_version: 7,
      encryption_format_version: 2
    }), { onConflict: "user_id,google_subject" });
  });
});
