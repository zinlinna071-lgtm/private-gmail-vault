import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  isSameOriginRequest: vi.fn(),
  isJsonContentType: vi.fn(),
  readBoundedJson: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser }
  })
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient
}));
vi.mock("@/lib/auth/vault", () => ({
  isSameOriginRequest: mocks.isSameOriginRequest
}));
vi.mock("@/lib/auth/content-type", () => ({
  isJsonContentType: mocks.isJsonContentType
}));
vi.mock("@/lib/auth/bounded-json", () => ({
  readBoundedJson: mocks.readBoundedJson
}));

import { GET, PUT } from "@/app/api/vault/key-metadata/route";

const userId = "11111111-1111-4111-8111-111111111111";
const validMetadata = {
  profileId: 1,
  salt: "AAAAAAAAAAAAAAAAAAAAAA==",
  wrappedKeyEnvelope: {
    version: 1,
    algorithm: "AES-256-GCM",
    iv: "AAAAAAAAAAAAAAAA",
    wrappedKey: "A".repeat(64)
  }
};

function putRequest(body: unknown) {
  return new Request("https://vault.example/api/vault/key-metadata", {
    method: "PUT",
    headers: {
      Origin: "https://vault.example",
      "Sec-Fetch-Site": "same-origin",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

function queryReturning(data: unknown, error: unknown = null) {
  const query: Record<string, any> = {};
  for (const method of ["select", "eq", "is", "update"]) {
    query[method] = vi.fn().mockReturnValue(query);
  }
  query.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  return query;
}

describe("Vault key metadata route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } } });
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.isJsonContentType.mockReturnValue(true);
    mocks.readBoundedJson.mockImplementation(async (request: Request) => ({
      ok: true,
      value: await request.json()
    }));
  });

  it("requires an authenticated user before reading metadata", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("returns only the public metadata for the authenticated profile", async () => {
    const row = {
      client_crypto_version: 1,
      client_kdf_algorithm: "argon2id-v1.3",
      client_kdf_profile: 1,
      client_kdf_salt: validMetadata.salt,
      client_wrapped_dek_iv: validMetadata.wrappedKeyEnvelope.iv,
      client_wrapped_dek: validMetadata.wrappedKeyEnvelope.wrappedKey,
      client_key_created_at: "2026-11-08T00:00:00.000Z"
    };
    const query = queryReturning(row);
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith("user_id", userId);
    expect(body.metadata.kdfAlgorithm).toBe("argon2id-v1.3");
    expect(body.metadata.wrappedKeyEnvelope.wrappedKey).toBe(validMetadata.wrappedKeyEnvelope.wrappedKey);
    expect(JSON.stringify(body)).not.toContain("unlockSecret");
    expect(JSON.stringify(body)).not.toContain("password");
  });

  it("rejects cross-origin initialization before reading the body", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);
    const response = await PUT(putRequest(validMetadata));
    expect(response.status).toBe(403);
    expect(mocks.readBoundedJson).not.toHaveBeenCalled();
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("rejects malformed envelopes and non-allowlisted KDF profiles", async () => {
    const invalid = {
      ...validMetadata,
      profileId: 99,
      wrappedKeyEnvelope: { ...validMetadata.wrappedKeyEnvelope, wrappedKey: "not-base64" }
    };
    const response = await PUT(putRequest(invalid));
    expect(response.status).toBe(400);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("initializes metadata once and never accepts raw key material", async () => {
    const row = {
      client_crypto_version: 1,
      client_kdf_algorithm: "argon2id-v1.3",
      client_kdf_profile: 1,
      client_kdf_salt: validMetadata.salt,
      client_wrapped_dek_iv: validMetadata.wrappedKeyEnvelope.iv,
      client_wrapped_dek: validMetadata.wrappedKeyEnvelope.wrappedKey,
      client_key_created_at: "2026-11-08T00:00:00.000Z"
    };
    const query = queryReturning(row);
    mocks.createSupabaseAdminClient.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

    const response = await PUT(putRequest(validMetadata));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({
      client_crypto_version: 1,
      client_kdf_algorithm: "argon2id-v1.3",
      client_wrapped_dek: validMetadata.wrappedKeyEnvelope.wrappedKey
    }));
    expect(query.is).toHaveBeenCalledWith("client_crypto_version", null);
    expect(body.metadata.version).toBe(1);
  });

  it("does not overwrite existing key metadata", async () => {
    const existingQuery = queryReturning(null);
    const readQuery = queryReturning({ client_crypto_version: 1 });
    const from = vi.fn()
      .mockReturnValueOnce(existingQuery)
      .mockReturnValueOnce(readQuery);
    mocks.createSupabaseAdminClient.mockReturnValue({ from });

    const response = await PUT(putRequest(validMetadata));
    expect(response.status).toBe(409);
    expect(existingQuery.is).toHaveBeenCalledWith("client_crypto_version", null);
  });
});
