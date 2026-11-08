"use strict";

const assert = require("node:assert/strict");
const { derive_key } = require("../pkg/vault_argon2_wasm_poc.js");

const password = new TextEncoder().encode("test-only WASM smoke input");
const saltA = new Uint8Array(16).fill(0x31);
const saltB = new Uint8Array(16).fill(0x32);

const first = derive_key(password, saltA, 1);
assert.ok(first instanceof Uint8Array, "WASM export returns Uint8Array");
assert.equal(first.length, 32, "derived key is exactly 32 bytes");

const repeated = derive_key(password, saltA, 1);
assert.deepEqual(repeated, first, "same inputs produce the same KDF output");

const otherSalt = derive_key(password, saltB, 1);
assert.notDeepEqual(otherSalt, first, "different salts produce different KDF output");

assert.throws(
  () => derive_key(password, new Uint8Array(15), 1),
);
assert.throws(
  () => derive_key(password, saltA, 255),
);
assert.throws(
  () => derive_key(new Uint8Array(0), saltA, 1),
);

first.fill(0);
repeated.fill(0);
otherSalt.fill(0);
password.fill(0);
saltA.fill(0);
saltB.fill(0);

process.stdout.write("WASM binding smoke tests passed.\n");
