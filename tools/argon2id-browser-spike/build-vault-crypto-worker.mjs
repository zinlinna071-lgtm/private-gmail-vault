import { build } from "esbuild";
import { resolve } from "node:path";

const root = resolve(process.cwd(), "../..");
const result = await build({
  absWorkingDir: root,
  entryPoints: ["lib/vault/crypto-worker.ts"],
  outfile: "security/argon2-wasm/browser-worker-test/vault-crypto-worker.bundle.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  sourcemap: false,
  minify: false,
  legalComments: "none",
  logLevel: "info"
});
if (result.errors.length) throw new Error("Application Worker bundle failed.");
console.log("Application Vault crypto Worker bundled for isolated browser testing.");
