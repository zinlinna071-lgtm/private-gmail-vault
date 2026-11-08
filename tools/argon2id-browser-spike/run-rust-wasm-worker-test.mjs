import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, normalize, sep } from "node:path";
import { chromium, firefox, webkit } from "playwright";

const repoRoot = resolve(process.cwd(), "../..");
const staticRoot = repoRoot;
const port = 4181;
const browsers = [["Chromium", chromium], ["Firefox", firefox], ["WebKit", webkit]];
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm"
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    const relative = normalize(pathname).replace(/^([/\\]|\.\.(?:[/\\]|$))+/g, "");
    const assetRelative = relative.startsWith("crypto/argon2/")
      ? resolve("public", relative)
      : relative;
    const file = resolve(staticRoot, assetRelative);
    if (file !== staticRoot && !file.startsWith(staticRoot + sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const info = await stat(file);
    if (!info.isFile()) throw new Error("not a file");
    response.writeHead(200, {
      "content-type": mime[extname(file)] || "application/octet-stream",
      "cache-control": "no-store",
      "cross-origin-opener-policy": "same-origin",
      "cross-origin-embedder-policy": "require-corp"
    });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end("Not found");
  }
});

await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(port, "127.0.0.1", resolveListen);
});

try {
  for (const [name, engine] of browsers) {
    const browser = await engine.launch({ headless: true });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("http://127.0.0.1:" + port + "/security/argon2-wasm/browser-worker-test/index.html");
      await page.waitForFunction(() => window.__argonWorkerResult?.done === true, undefined, { timeout: 180000 });
      const result = await page.evaluate(() => window.__argonWorkerResult);
      if (errors.length || !result.ok) {
        throw new Error(name + ": " + (errors.join("; ") || result.error || "Worker test failed"));
      }
      console.log("PASS: " + name + " — Rust Argon2id WASM ran inside dedicated module Worker");
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise(resolveClose => server.close(resolveClose));
}
