import { describe, expect, it } from "vitest";
import { createOpaqueToken, hashOpaqueToken } from "@/lib/auth/curator-claim";

describe("Curator one-time claim primitives", () => {
  it("creates an opaque 256-bit base64url token", () => {
    const token = createOpaqueToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });

  it("stores a fixed-length SHA-256 digest rather than the raw token", () => {
    const token = createOpaqueToken();
    const digest = hashOpaqueToken(token);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toBe(token);
    expect(hashOpaqueToken(token)).toBe(digest);
  });

  it("produces different digests for different tokens", () => {
    expect(hashOpaqueToken(createOpaqueToken())).not.toBe(hashOpaqueToken(createOpaqueToken()));
  });
});
