import "server-only";

import type { JsonRpcClient } from "./sepolia-rpc";

const SEPOLIA_CHAIN_ID = 11155111;

export function createSepoliaRpcClient(
  endpoint: string,
  fetcher: typeof fetch = fetch
): JsonRpcClient {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error("SEPOLIA_RPC_URL must be a valid HTTPS URL");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
    throw new Error("SEPOLIA_RPC_URL must be HTTPS and must not contain credentials or a fragment");
  }
  if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1" || parsed.hostname.endsWith(".local")) {
    throw new Error("Local RPC endpoints are not permitted in this deployment adapter");
  }

  let requestId = 0;
  return {
    async request<T>(method: string, params: readonly unknown[]): Promise<T> {
      const response = await fetcher(parsed.toString(), {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: ++requestId,
          method,
          params
        })
      });
      if (!response.ok) throw new Error("Sepolia RPC request failed");
      const payload: unknown = await response.json();
      if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
        throw new Error("Malformed JSON-RPC response");
      }
      const body = payload as Record<string, unknown>;
      if (body.jsonrpc !== "2.0" || body.id !== requestId) {
        throw new Error("JSON-RPC response identifier mismatch");
      }
      if (body.error !== undefined) throw new Error("Sepolia RPC returned an error");
      if (!("result" in body)) throw new Error("JSON-RPC result is missing");
      return body.result as T;
    }
  };
}

export function getSepoliaRpcClient(fetcher: typeof fetch = fetch): JsonRpcClient {
  const endpoint = process.env.SEPOLIA_RPC_URL;
  if (!endpoint) throw new Error("Sepolia RPC is not configured");
  return createSepoliaRpcClient(endpoint, fetcher);
}

export { SEPOLIA_CHAIN_ID };
