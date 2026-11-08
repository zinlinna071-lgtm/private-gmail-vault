import assert from "node:assert/strict";

const subtle = globalThis.crypto?.subtle;
assert.ok(subtle, "Node.js Web Crypto API is required");

const fromHex = (value) => {
  assert.equal(value.length % 2, 0, "Hex input must have an even length");
  return Uint8Array.from(value.match(/.{2}/g) ?? [], byte => Number.parseInt(byte, 16));
};

const toHex = (value) =>
  Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, "0")).join("");

const equalHex = (actual, expected, label) => {
  assert.equal(toHex(actual), expected, label);
};

const expectReject = async (operation, label) => {
  await assert.rejects(operation, undefined, label);
};

async function testHkdfSha256() {
  // RFC 5869 Appendix A.1 — public test data only.
  const ikm = new Uint8Array(22).fill(0x0b);
  const salt = fromHex("000102030405060708090a0b0c");
  const info = fromHex("f0f1f2f3f4f5f6f7f8f9");
  const expected =
    "3cb25f25faacd57a90434f64d0362f2a" +
    "2d2d0a90cf1a5a4c5db02d56ecc4c5bf" +
    "34007208d5b887185865";

  const key = await subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const actual = await subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    key,
    42 * 8
  );
  equalHex(actual, expected, "HKDF-SHA-256 RFC 5869 Test Case 1 mismatch");

  const changedIkm = ikm.slice();
  changedIkm[0] ^= 0x01;
  const changedKey = await subtle.importKey("raw", changedIkm, "HKDF", false, ["deriveBits"]);
  const changed = await subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    changedKey,
    42 * 8
  );
  assert.notEqual(toHex(changed), expected, "Changing IKM must change HKDF output");

  ikm.fill(0);
  changedIkm.fill(0);
  salt.fill(0);
  info.fill(0);
  console.log("PASS: HKDF-SHA-256 RFC 5869 Test Case 1");
  console.log("PASS: HKDF IKM mutation check");
}

async function testAesGcmVector({ name, keyHex, ivHex, plaintextHex, aadHex, ciphertextHex, tagHex }) {
  const rawKey = fromHex(keyHex);
  const iv = fromHex(ivHex);
  const plaintext = fromHex(plaintextHex);
  const aad = fromHex(aadHex);
  const expectedCombined = ciphertextHex + tagHex;
  assert.equal(rawKey.length, 32, name + ": AES-256 key length");
  assert.equal(iv.length, 12, name + ": 96-bit IV length");
  assert.equal(fromHex(tagHex).length, 16, name + ": 128-bit tag length");

  const key = await subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const combined = await subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 },
    key,
    plaintext
  );
  equalHex(combined, expectedCombined, name + ": NIST AES-GCM encryption mismatch");

  const decrypted = await subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 },
    key,
    fromHex(expectedCombined)
  );
  equalHex(decrypted, plaintextHex, name + ": NIST AES-GCM decryption mismatch");

  const combinedBytes = fromHex(expectedCombined);
  if (combinedBytes.length > 0) {
    const changedCiphertextOrTag = combinedBytes.slice();
    changedCiphertextOrTag[0] ^= 0x01;
    await expectReject(
      () => subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 },
        key,
        changedCiphertextOrTag
      ),
      name + ": modified ciphertext/tag must fail authentication"
    );
  }

  const changedIv = iv.slice();
  changedIv[0] ^= 0x01;
  await expectReject(
    () => subtle.decrypt(
      { name: "AES-GCM", iv: changedIv, additionalData: aad, tagLength: 128 },
      key,
      fromHex(expectedCombined)
    ),
    name + ": modified IV must fail authentication"
  );

  const changedAad = new Uint8Array(aad.length + 1);
  changedAad.set(aad);
  changedAad[changedAad.length - 1] = 0x01;
  await expectReject(
    () => subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: changedAad, tagLength: 128 },
      key,
      fromHex(expectedCombined)
    ),
    name + ": modified AAD must fail authentication"
  );

  const changedKeyBytes = rawKey.slice();
  changedKeyBytes[0] ^= 0x01;
  const changedKey = await subtle.importKey(
    "raw", changedKeyBytes, { name: "AES-GCM" }, false, ["decrypt"]
  );
  await expectReject(
    () => subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 },
      changedKey,
      fromHex(expectedCombined)
    ),
    name + ": modified key must fail authentication"
  );

  rawKey.fill(0);
  changedKeyBytes.fill(0);
  iv.fill(0);
  plaintext.fill(0);
  aad.fill(0);
  combinedBytes.fill(0);
  changedIv.fill(0);
  changedAad.fill(0);
  console.log("PASS: " + name + " encryption/decryption and tamper checks");
}

await testHkdfSha256();

await testAesGcmVector({
  name: "NIST CAVP AES-256-GCM vector A (non-empty plaintext)",
  keyHex: "31bdadd96698c204aa9ce1448ea94ae1fb4a9a0b3c9d773b51bb1822666b8f22",
  ivHex: "0d18e06c7c725ac9e362e1ce",
  plaintextHex: "2db5168e932556f8089a0622981d017d",
  aadHex: "",
  ciphertextHex: "fa4362189661d163fcd6a56d8bf0405a",
  tagHex: "d636ac1bbedd5cc3ee727dc2ab4a9489"
});

await testAesGcmVector({
  name: "NIST CAVP AES-256-GCM vector B (non-empty AAD)",
  keyHex: "78dc4e0aaf52d935c3c01eea57428f00ca1fd475f5da86a49c8dd73d68c8e223",
  ivHex: "d79cf22d504cc793c3fb6c8a",
  plaintextHex: "",
  aadHex: "b96baa8c1c75a671bfb2d08d06be5f36",
  ciphertextHex: "",
  tagHex: "3e5d486aa2e30b22e040b85723a06e76"
});

console.log("All isolated cryptographic primitive vectors passed.");
