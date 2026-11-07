import { argon2idAsync } from "@noble/hashes/argon2.js";

const bytes = (length, value) => new Uint8Array(length).fill(value);
const toHex = (value) =>
  Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");

const expected =
  "0d640df58d78766c08c037a34a8b53c9" +
  "d01ef0452d75b65eb52520e96b01e659";

const derive = (password, salt, key, associatedData) =>
  argon2idAsync(password, salt, {
    t: 3,
    m: 32,
    p: 4,
    dkLen: 32,
    version: 0x13,
    key,
    personalization: associatedData,
    maxmem: 1024 * 1024
  });

async function run() {
  const password = bytes(32, 0x01);
  const salt = bytes(16, 0x02);
  const secret = bytes(8, 0x03);
  const associatedData = bytes(12, 0x04);
  const checks = [];
  let actual;

  try {
    actual = await derive(password, salt, secret, associatedData);
    if (actual.length !== 32 || toHex(actual) !== expected) {
      throw new Error("RFC 9106 §5.3 known-answer test failed in browser.");
    }
    checks.push("PASS: RFC 9106 §5.3 exact output");

    const mutations = [
      ["password", password, 0],
      ["salt", salt, 0],
      ["secret K", secret, 0],
      ["associated data X", associatedData, 0]
    ];

    for (const [label, source, index] of mutations) {
      const changedPassword = password.slice();
      const changedSalt = salt.slice();
      const changedSecret = secret.slice();
      const changedAssociatedData = associatedData.slice();
      const targets = {
        password: changedPassword,
        salt: changedSalt,
        "secret K": changedSecret,
        "associated data X": changedAssociatedData
      };
      let changedOutput;

      try {
        targets[label][index] ^= 0x01;
        changedOutput = await derive(
          changedPassword,
          changedSalt,
          changedSecret,
          changedAssociatedData
        );
        if (toHex(changedOutput) === expected) {
          throw new Error("Changing " + label + " did not change output.");
        }
        checks.push("PASS: changing " + label + " changes output");
      } finally {
        changedPassword.fill(0);
        changedSalt.fill(0);
        changedSecret.fill(0);
        changedAssociatedData.fill(0);
        changedOutput?.fill(0);
      }
    }

    document.querySelector("#result").textContent = checks.join("\n");
    window.__argon2Result = { done: true, ok: true, checks };
  } catch (error) {
    document.querySelector("#result").textContent =
      error instanceof Error ? error.message : "Unknown browser test failure";
    window.__argon2Result = {
      done: true,
      ok: false,
      error: String(error)
    };
  } finally {
    password.fill(0);
    salt.fill(0);
    secret.fill(0);
    associatedData.fill(0);
    actual?.fill(0);
  }
}

void run();
