import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getUser: vi.fn(),
  isSameOriginRequest: vi.fn(),
  readBoundedJson: vi.fn(),
  isJsonContentType: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient
}));
vi.mock("@/lib/auth/vault", () => ({
  isSameOriginRequest: mocks.isSameOriginRequest
}));
vi.mock("@/lib/auth/bounded-json", () => ({
  readBoundedJson: mocks.readBoundedJson
}));
vi.mock("@/lib/auth/content-type", () => ({
  isJsonContentType: mocks.isJsonContentType
}));

import { GET, POST } from "@/app/api/vault/client-items/route";
import { DELETE, PUT } from "@/app/api/vault/client-items/[id]/route";

const ownerId = "11111111-1111-4111-8111-111111111111";
const recordId = "22222222-2222-4222-8222-222222222222";
const envelope = {
  version: 1,
  algorithm: "AES-256-GCM",
  iv: Buffer.alloc(12, 1).toString("base64"),
  ciphertext: Buffer.from("opaque encrypted bytes").toString("base64"),
  authTag: Buffer.alloc(16, 2).toString("base64")
};
const requestHeaders = {
  Origin: "https://vault.example",
  "Sec-Fetch-Site": "same-origin",
  "Content-Type": "application/json"
};

describe("ciphertext-only Vault API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const query = {
      select: mocks.select,
      eq: mocks.eq,
      order: mocks.order,
      update: mocks.update,
      delete: mocks.delete,
      maybeSingle: mocks.maybeSingle
    };
    mocks.getUser.mockResolvedValue({ data: { user: { id: ownerId } } });
    mocks.createSupabaseServerClient.mockResolvedValue({ auth: { getUser: mocks.getUser } });
    mocks.createSupabaseAdminClient.mockReturnValue({
      from: () => query,
      rpc: mocks.rpc
    });
    mocks.select.mockReturnValue(query);
    mocks.eq.mockReturnValue(query);
    mocks.order.mockResolvedValue({
      data: [{
        id: recordId,
        ciphertext: envelope.ciphertext,
        iv: envelope.iv,
        auth_tag: envelope.authTag,
        created_at: "2026-11-09T00:00:00.000Z",
        updated_at: "2026-11-09T00:00:00.000Z"
      }],
      error: null
    });
    mocks.maybeSingle.mockResolvedValue({
      data: { client_crypto_version: 1, id: recordId, created_at: "2026-11-09T00:00:00.000Z", updated_at: "2026-11-09T00:00:00.000Z" },
      error: null
    });
    mocks.update.mockReturnValue(query);
    mocks.delete.mockReturnValue(query);
    mocks.rpc.mockResolvedValue({
      data: [{ id: recordId, created_at: "2026-11-09T00:00:00.000Z", updated_at: "2026-11-09T00:00:00.000Z" }],
      error: null
    });
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.isJsonContentType.mockReturnValue(true);
    mocks.readBoundedJson.mockResolvedValue({ ok: true, value: { id: recordId, envelope } });
  });

  it("returns only client-v1 opaque envelopes and filters by authenticated owner", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0]).toEqual(expect.objectContaining({ id: recordId, envelope }));
    expect(body.items[0]).not.toHaveProperty("password");
    expect(mocks.eq).toHaveBeenCalledWith("user_id", ownerId);
    expect(mocks.eq).toHaveBeenCalledWith("encryption_scheme", "client-aes-256-gcm-v1");
  });

  it("rejects unauthenticated reads before accessing storage", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("requires initialized client key metadata before listing records", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { client_crypto_version: null }, error: null });
    const response = await GET();
    expect(response.status).toBe(409);
    expect(mocks.order).not.toHaveBeenCalled();
  });

  it("accepts only ciphertext envelopes and inserts through the quota-enforcing RPC", async () => {
    const response = await POST(new Request("https://vault.example/api/vault/client-items", {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify({ id: recordId, envelope })
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.item).toEqual(expect.objectContaining({ id: recordId, envelope }));
    expect(mocks.rpc).toHaveBeenCalledWith("create_client_vault_item_with_quota", {
      p_user_id: ownerId,
      p_id: recordId,
      p_ciphertext: envelope.ciphertext,
      p_iv: envelope.iv,
      p_auth_tag: envelope.authTag
    });
  });

  it("rejects plaintext credential fields instead of forwarding them", async () => {
    mocks.readBoundedJson.mockResolvedValue({
      ok: true,
      value: { id: recordId, envelope, accountName: "email", password: "plaintext-secret" }
    });
    const response = await POST(new Request("https://vault.example/api/vault/client-items", {
      method: "POST",
      headers: requestHeaders,
      body: "{}"
    }));
    expect(response.status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects cross-origin writes before authentication or storage", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);
    const response = await POST(new Request("https://vault.example/api/vault/client-items", {
      method: "POST",
      headers: requestHeaders,
      body: "{}"
    }));
    expect(response.status).toBe(403);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("updates only an owned client-v1 row and returns its opaque envelope", async () => {
    mocks.readBoundedJson.mockResolvedValue({ ok: true, value: { envelope } });
    const response = await PUT(new Request("https://vault.example/api/vault/client-items/" + recordId, {
      method: "PUT",
      headers: requestHeaders,
      body: JSON.stringify({ envelope })
    }), { params: Promise.resolve({ id: recordId }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.item.envelope).toEqual(envelope);
    expect(mocks.eq).toHaveBeenCalledWith("id", recordId);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", ownerId);
    expect(mocks.eq).toHaveBeenCalledWith("encryption_scheme", "client-aes-256-gcm-v1");
  });

  it("deletes only an owned client-v1 row", async () => {
    const response = await DELETE(new Request("https://vault.example/api/vault/client-items/" + recordId, {
      method: "DELETE",
      headers: requestHeaders
    }), { params: Promise.resolve({ id: recordId }) });

    expect(response.status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", ownerId);
    expect(mocks.eq).toHaveBeenCalledWith("encryption_scheme", "client-aes-256-gcm-v1");
  });
});
