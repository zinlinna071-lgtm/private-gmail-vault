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
      keyVersion: 1
    });
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    mocks.upsertSingle.mockResolvedValue({ data: { id: "connection-1" }, error: null });
    mocks.auditInsert.mockResolvedValue({ error: null });

    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mocks.maybeSingle,
      single: mocks.upsertSingle
    };
    const table = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: mocks.maybeSingle,
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mocks.upsertSingle })
      }),
      insert: mocks.auditInsert
    };
    mocks.createSupabaseAdminClient.mockReturnValue({
      from: vi.fn((name: string) => name === "gmail_connections" ? table : { insert: mocks.auditInsert })
    });
    void query;
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

  it("exchanges the code, verifies Gmail scope, encrypts and persists the refresh token", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url === "https://oauth2.googleapis.com/token") {
        return Response.json({ access_token: "synthetic-access-token", refresh_token: "synthetic-refresh-token" });
      }
      if (url.startsWith("https://oauth2.googleapis.com/tokeninfo")) {
        return Response.json({ scope: "openid email https://www.googleapis.com/auth/gmail.readonly" });
      }
      if (url === "https://www.googleapis.com/oauth2/v3/userinfo") {
        return Response.json({ sub: "google-subject-1", email: "Owner@Example.com", email_verified: true, name: "Vault Owner" });
      }
      throw new Error("Unexpected external request");
    }) as typeof fetch;

    const state = signedState();
    const response = await GET(makeRequest(`?state=${state.nonce}&code=synthetic-auth-code`, state.cookie));

    expect(response.headers.get("location")).toContain("/vault?gmail_connected=1");
    expect(calls).toHaveLength(3);
    expect(calls[0].init?.method).toBe("POST");
    expect(String(calls[0].init?.body)).toContain("grant_type=authorization_code");
    expect(mocks.encryptRefreshToken).toHaveBeenCalledWith("synthetic-refresh-token");
    expect(mocks.maybeSingle).toHaveBeenCalled();
    expect(mocks.upsertSingle).toHaveBeenCalledWith();
  });
});
