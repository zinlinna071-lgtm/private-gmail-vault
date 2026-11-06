/**
 * Read and parse a JSON request body with a hard byte limit.
 *
 * Content-Length is only an early-rejection hint: the streamed byte count is
 * always enforced as well, so chunked requests and under-reported lengths
 * cannot bypass the limit.
 */
export type BoundedJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; reason: "too_large" | "invalid_json" };

export async function readBoundedJson(
  request: Request,
  maxBytes: number
): Promise<BoundedJsonResult> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("A positive request body limit is required.");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\\d+$/.test(contentLength)) {
      return { ok: false, reason: "invalid_json" };
    }
    if (Number(contentLength) > maxBytes) {
      return { ok: false, reason: "too_large" };
    }
  }

  if (!request.body) return { ok: false, reason: "invalid_json" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        value.fill(0);
        for (const chunk of chunks) chunk.fill(0);
        try {
          await reader.cancel();
        } catch {
          // The request is already being rejected; cancellation is best effort.
        }
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    for (const chunk of chunks) chunk.fill(0);
    return { ok: false, reason: "invalid_json" };
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  try {
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(source) as unknown };
  } catch {
    return { ok: false, reason: "invalid_json" };
  } finally {
    bytes.fill(0);
    for (const chunk of chunks) chunk.fill(0);
  }
}
