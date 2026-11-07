import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import { chromium, firefox, webkit } from "playwright";

const root = process.cwd();
const output = resolve(root, "dist/browser-test.js");
const port = 4178;
const browsers = [
  ["Chromium", chromium],
  ["Firefox", firefox],
  ["WebKit", webkit]
];

await build({
  entryPoints: [resolve(root, "browser-test-entry.js")],
  outfile: output,
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022"
});

const server = createServer(async (request, response) => {
  try {
    if (request.url === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(await readFile(resolve(root, "index.html")));
      return;
    }
    if (request.url === "/browser-test.js") {
      response.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      response.end(await readFile(output));
      return;
    }
    response.writeHead(404);
    response.end("Not found");
  } catch {
    response.writeHead(500);
    response.end("Test server error");
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
      page.on("pageerror", (error) => {
        throw error;
      });
      await page.goto("http://127.0.0.1:" + port);
      await page.waitForFunction(() => window.__argon2Result?.done === true, {
        timeout: 120_000
      });

      const result = await page.evaluate(() => window.__argon2Result);
      if (!result.ok) {
        throw new Error(name + ": " + (result.error || "Browser compatibility test failed."));
      }
      for (const check of result.checks) console.log(name + " — " + check);
      console.log("PASS: " + name + " Argon2id compatibility");
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}
