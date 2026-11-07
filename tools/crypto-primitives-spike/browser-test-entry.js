const fromHex = (value) => {
  if (value.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(value)) {
    throw new Error("Invalid hexadecimal test fixture.");
  }
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
};

const toHex = (value) =>
  Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, "0")).join("");

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const expectAuthenticationFailure = async (operation, label) => {
  let rejected = false;
  try {
    await operation();
  } catch {
    rejected = true;
  }
  assert(rejected, label + " was accepted but should have been rejected.");
};

async function testHkdf(subtle, checks) {
  const ikm = new Uint8Array(22).fill(0x0b);
  const salt = fromHex("000102030405060708090a0b0c");
  const info = fromHex("f0f1f2f3f4f5f6f7f8f9");
  const expected = "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865";
  const importHkdfKey = (bytes) =>
    subtle.importKey("raw", bytes, "HKDF", false, ["deriveBits"]);
  const derive = (key) =>
    subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt, info },
      key,
      42 * 8
    );

  const key = await importHkdfKey(ikm);
  const output = await derive(key);
  assert(toHex(output) === expected, "HKDF RFC 5869 Test Case 1 output mismatch.");
  checks.push("HKDF-SHA-256: standard answer matches exactly");

  const changedIkm = ikm.slice();
  changedIkm[0] ^= 0x01;
  const changedOutput = await derive(await importHkdfKey(changedIkm));
  assert(toHex(changedOutput) !== expected, "Changing HKDF input did not change the output.");
  checks.push("HKDF-SHA-256: changing the input changes the result");

  ikm.fill(0);
  changedIkm.fill(0);
  salt.fill(0);
  info.fill(0);
  new Uint8Array(output).fill(0);
  new Uint8Array(changedOutput).fill(0);
}

async function testAesGcmVector(subtle, vector, checks) {
  const keyBytes = fromHex(vector.key);
  const iv = fromHex(vector.iv);
  const plaintext = fromHex(vector.plaintext);
  const aad = fromHex(vector.aad);
  const expectedCombined = vector.ciphertext + vector.tag;
  const expectedCombinedBytes = fromHex(expectedCombined);

  assert(keyBytes.length === 32, vector.name + ": key must be 32 bytes.");
  assert(iv.length === 12, vector.name + ": IV must be 12 bytes.");
  assert(fromHex(vector.tag).length === 16, vector.name + ": tag must be 16 bytes.");

  const key = await subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  const parameters = { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 };
  const encrypted = await subtle.encrypt(parameters, key, plaintext);
  assert(
    toHex(encrypted) === expectedCombined,
    vector.name + ": encrypted ciphertext/tag differs from the published answer."
  );
  checks.push(vector.name + ": encryption matches the published answer");

  const decrypted = await subtle.decrypt(parameters, key, expectedCombinedBytes);
  assert(toHex(decrypted) === vector.plaintext, vector.name + ": decryption mismatch.");
  checks.push(vector.name + ": decryption recovers the original input");

  const changedCombined = expectedCombinedBytes.slice();
  changedCombined[0] ^= 0x01;
  await expectAuthenticationFailure(
    () => subtle.decrypt(parameters, key, changedCombined),
    vector.name + " changed ciphertext/tag"
  );
  checks.push(vector.name + ": changed data is rejected");

  const changedTag = expectedCombinedBytes.slice();
  changedTag[changedTag.length - 1] ^= 0x01;
  await expectAuthenticationFailure(
    () => subtle.decrypt(parameters, key, changedTag),
    vector.name + " changed authentication tag"
  );
  checks.push(vector.name + ": changed authentication tag is rejected");

  const changedIv = iv.slice();
  changedIv[0] ^= 0x01;
  await expectAuthenticationFailure(
    () => subtle.decrypt({ ...parameters, iv: changedIv }, key, expectedCombinedBytes),
    vector.name + " changed IV"
  );

  const changedAad = new Uint8Array(aad.length + 1);
  changedAad.set(aad);
  changedAad[changedAad.length - 1] = 0x01;
  await expectAuthenticationFailure(
    () => subtle.decrypt({ ...parameters, additionalData: changedAad }, key, expectedCombinedBytes),
    vector.name + " changed additional authenticated data"
  );

  const changedKeyBytes = keyBytes.slice();
  changedKeyBytes[0] ^= 0x01;
  const changedKey = await subtle.importKey(
    "raw",
    changedKeyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  await expectAuthenticationFailure(
    () => subtle.decrypt(parameters, changedKey, expectedCombinedBytes),
    vector.name + " changed key"
  );
  checks.push(vector.name + ": changed IV, context, and key are rejected");

  keyBytes.fill(0);
  iv.fill(0);
  plaintext.fill(0);
  aad.fill(0);
  expectedCombinedBytes.fill(0);
  changedCombined.fill(0);
  changedTag.fill(0);
  changedIv.fill(0);
  changedAad.fill(0);
  changedKeyBytes.fill(0);
  new Uint8Array(decrypted).fill(0);
}

async function run() {
  const checks = [];
  try {
    if (!globalThis.crypto?.subtle) {
      throw new Error("This browser does not provide the Web Crypto API.");
    }

    await testHkdf(globalThis.crypto.subtle, checks);

    await testAesGcmVector(globalThis.crypto.subtle, {
      name: "AES-256-GCM vector A",
      key: "31bdadd96698c204aa9ce1448ea94ae1fb4a9a0b3c9d773b51bb1822666b8f22",
      iv: "0d18e06c7c725ac9e362e1ce",
      plaintext: "2db5168e932556f8089a0622981d017d",
      aad: "",
      ciphertext: "fa4362189661d163fcd6a56d8bf0405a",
      tag: "d636ac1bbedd5cc3ee727dc2ab4a9489"
    }, checks);

    await testAesGcmVector(globalThis.crypto.subtle, {
      name: "AES-256-GCM vector B",
      key: "78dc4e0aaf52d935c3c01eea57428f00ca1fd475f5da86a49c8dd73d68c8e223",
      iv: "d79cf22d504cc793c3fb6c8a",
      plaintext: "",
      aad: "b96baa8c1c75a671bfb2d08d06be5f36",
      ciphertext: "",
      tag: "3e5d486aa2e30b22e040b85723a06e76"
    }, checks);

    document.querySelector("#result").textContent = checks.map((item) => "PASS  " + item).join("\n");
    window.__vaultCryptoResult = { done: true, ok: true, checks };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown browser test failure.";
    document.querySelector("#result").textContent = "FAIL  " + message;
    window.__vaultCryptoResult = { done: true, ok: false, error: message, checks };
  }
}

void run();
