import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import { chromium, firefox, webkit } from "playwright";

const root = process.cwd();
const entry = resolve(root, "../crypto-primitives-spike/browser-test-entry.js");
const output = resolve(root, "dist/crypto-primitives-browser-test.js");
const port = 4180;
const browsers = [
  ["Chromium", chromium],
  ["Firefox", firefox],
  ["WebKit", webkit]
];

await build({
  entryPoints: [entry],
  outfile: output,
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022"
});

const html = [
  "<!doctype html>",
  '<html lang="en"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  "<title>Vault Web Crypto test harness</title></head><body>",
  "<main><h1>Isolated Web Crypto compatibility checks</h1>",
  "<p>Public known-answer vectors only. No Vault credentials or application APIs.</p>",
  '<pre id="result" aria-live="polite">RUNNING</pre></main>',
  '<script src="/browser-test.js"></script></body></html>'
].join("");

const server = createServer(async (request, response) => {
  if (request.url === "/") {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }
  if (request.url === "/browser-test.js") {
    try {
      response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      response.end(await readFile(output));
    } catch {
      response.writeHead(500);
      response.end("Unable to load isolated test bundle.");
    }
    return;
  }
  response.writeHead(404);
  response.end("Not found");
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
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto("http://127.0.0.1:" + port);
      await page.waitForFunction(
        () => window.__vaultCryptoResult?.done === true,
        undefined,
        { timeout: 60_000 }
      );

      const result = await page.evaluate(() => window.__vaultCryptoResult);
      if (pageErrors.length > 0) {
        throw new Error(name + ": browser runtime error: " + pageErrors.join("; "));
      }
      if (!result.ok) {
        throw new Error(name + ": " + (result.error || "Web Crypto tests failed."));
      }
      for (const check of result.checks) console.log(name + " — PASS — " + check);
      console.log("PASS: " + name + " Web Crypto compatibility");
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
