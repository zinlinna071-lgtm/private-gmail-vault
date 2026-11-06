import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  isSameOriginRequest: vi.fn(),
  signOut: vi.fn()
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient
}));
vi.mock("@/lib/auth/vault", () => ({
  isSameOriginRequest: mocks.isSameOriginRequest
}));

import { POST } from "@/app/api/auth/logout/route";

function request(origin = "https://vault.example") {
  return new Request("https://vault.example/api/auth/logout", {
    method: "POST",
    headers: {
      Origin: origin,
      "Sec-Fetch-Site": "same-origin"
    }
  });
}

describe("Vault logout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.signOut.mockResolvedValue({ error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { signOut: mocks.signOut }
    });
  });

  it("rejects cross-origin logout before touching the session", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);

    const response = await POST(request("https://attacker.example"));

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("revokes the Supabase session before redirecting to the login page", async () => {
    const response = await POST(request());

    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://vault.example/");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("does not claim logout succeeded when Supabase revocation fails", async () => {
    mocks.signOut.mockResolvedValue({ error: new Error("session revoke failed") });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("Could not complete sign out. Please retry.");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("location")).toBeNull();
  });
});
