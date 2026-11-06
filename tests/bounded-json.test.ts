import { describe, expect, it } from "vitest";
import { readBoundedJson } from "../lib/auth/bounded-json";

function request(body: string, headers: Record<string, string> = {}) {
  return new Request("https://vault.example.test/api", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body
  });
}

describe("bounded streaming JSON reader", () => {
  it("parses valid JSON within the byte limit", async () => {
    await expect(readBoundedJson(request('{"ok":true}'), 32)).resolves.toEqual({
      ok: true,
      value: { ok: true }
    });
  });

  it("rejects a body above the limit using Content-Length", async () => {
    await expect(readBoundedJson(request('{"ok":true}', { "Content-Length": "100" }), 32))
      .resolves.toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects malformed JSON", async () => {
    await expect(readBoundedJson(request("{"), 32))
      .resolves.toEqual({ ok: false, reason: "invalid_json" });
  });

  it("rejects invalid UTF-8", async () => {
    const body = new Uint8Array([0xc3, 0x28]);
    const req = new Request("https://vault.example.test/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
    await expect(readBoundedJson(req, 32))
      .resolves.toEqual({ ok: false, reason: "invalid_json" });
  });

  it("enforces the streamed byte limit even without Content-Length", async () => {
    const encoder = new TextEncoder();
    const payload = encoder.encode('{"secret":"' + "x".repeat(64) + '"}');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(payload);
        controller.close();
      }
    });
    const req = new Request("https://vault.example.test/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stream,
      // Force a streaming request without a Content-Length header.
      // Node's Request implementation will use chunked transfer encoding.
      duplex: "half"
    } as RequestInit & { duplex: "half" });

    await expect(readBoundedJson(req, 32))
      .resolves.toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects invalid configured limits", async () => {
    await expect(readBoundedJson(request("{}"), 0)).rejects.toThrow();
  });
});
