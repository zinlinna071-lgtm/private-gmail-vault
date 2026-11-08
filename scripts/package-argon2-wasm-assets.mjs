import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";

const root = process.cwd();
const source = resolve(root, "security/argon2-wasm/pkg-web");
const destination = resolve(root, "public/crypto/argon2");
const required = [
  "vault_argon2_wasm_poc.js",
  "vault_argon2_wasm_poc_bg.wasm",
  "vault_argon2_wasm_poc.d.ts"
];

const sourceEntries = await readdir(source, { withFileTypes: true }).catch(() => {
  throw new Error("Browser WASM bindings are missing. Run the pinned Rust/wasm-bindgen build first.");
});
const sourceFiles = sourceEntries.filter(entry => entry.isFile()).map(entry => entry.name);
for (const name of required) {
  if (!sourceFiles.includes(name)) {
    throw new Error("Missing generated browser binding: " + name);
  }
}
if (sourceEntries.some(entry => !entry.isFile())) {
  throw new Error("Unexpected nested content in generated browser binding directory.");
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

const files = [];
for (const name of required) {
  const from = resolve(source, name);
  const to = resolve(destination, name);
  await copyFile(from, to);
  const bytes = await readFile(to);
  files.push({
    path: name,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex")
  });
}

const manifest = {
  format: "vault-argon2-wasm-assets",
  version: 1,
  generatedBy: "scripts/package-argon2-wasm-assets.mjs",
  files
};
await writeFile(
  resolve(destination, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  { encoding: "utf8", flag: "wx" }
);

const written = await readdir(destination);
const expected = [...required, "manifest.json"].sort();
if (written.sort().join("\n") !== expected.join("\n")) {
  throw new Error("Packaged asset directory contains unexpected or missing files.");
}
console.log("Packaged Argon2id browser assets:");
for (const file of files) console.log(file.path + " " + file.bytes + " bytes sha256=" + file.sha256);
console.log("Manifest: public/crypto/argon2/manifest.json");
