import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  getUser: vi.fn(),
  decryptVaultItem: vi.fn(),
  encryptVaultItem: vi.fn(),
  isSameOriginRequest: vi.fn(),
  readBoundedJson: vi.fn(),
  isJsonContentType: vi.fn(),
  select: vi.fn(),
  order: vi.fn(),
  eq: vi.fn(),
  delete: vi.fn(),
  maybeSingle: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient
}));
vi.mock("@/lib/vault/item-encryption", () => ({
  decryptVaultItem: mocks.decryptVaultItem,
  encryptVaultItem: mocks.encryptVaultItem
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

import { GET } from "@/app/api/vault/items/route";
import { DELETE } from "@/app/api/vault/items/[id]/route";

const ownerId = "11111111-1111-4111-8111-111111111111";
const foreignRecordId = "22222222-2222-4222-8222-222222222222";

describe("Vault API authorization boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const query = {
      eq: mocks.eq,
      order: mocks.order,
      select: mocks.select,
      maybeSingle: mocks.maybeSingle
    };
    mocks.getUser.mockResolvedValue({ data: { user: { id: ownerId } } });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser }
    });
    mocks.createSupabaseAdminClient.mockReturnValue({
      from: () => ({
        select: mocks.select,
        delete: mocks.delete
      })
    });

    mocks.select.mockReturnValue(query);
    mocks.order.mockResolvedValue({ data: [], error: null });
    mocks.eq.mockReturnValue(query);
    mocks.delete.mockReturnValue(query);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    mocks.decryptVaultItem.mockReturnValue(JSON.stringify({
      accountName: "Synthetic test account",
      username: "synthetic-user",
      password: "synthetic-secret",
      backupCodes: ""
    }));
    mocks.isSameOriginRequest.mockReturnValue(true);
  });

  it("denies Vault reads when there is no authenticated session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe("Please sign in again.");
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("scopes Vault record reads to the authenticated user ID", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", ownerId);
    expect(mocks.order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });

  it("scopes record deletion by both record ID and authenticated user ID", async () => {
    const response = await DELETE(
      new Request("https://vault.example/api/vault/items/" + foreignRecordId, {
        method: "DELETE",
        headers: { Origin: "https://vault.example", "Sec-Fetch-Site": "same-origin" }
      }),
      { params: Promise.resolve({ id: foreignRecordId }) }
    );

    expect(response.status).toBe(404);
    expect(mocks.eq).toHaveBeenCalledWith("id", foreignRecordId);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", ownerId);
  });

  it("rejects cross-origin delete attempts before querying storage", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);

    const response = await DELETE(
      new Request("https://vault.example/api/vault/items/" + foreignRecordId, {
        method: "DELETE",
        headers: { Origin: "https://attacker.example" }
      }),
      { params: Promise.resolve({ id: foreignRecordId }) }
    );

    expect(response.status).toBe(403);
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
