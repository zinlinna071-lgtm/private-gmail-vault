import assert from 'node:assert/strict';
import { argon2idAsync } from '@noble/hashes/argon2.js';

const bytes = (length, value) => new Uint8Array(length).fill(value);
const toHex = (value) =>
  Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');

const expected =
  '0d640df58d78766c08c037a34a8b53c9' +
  'd01ef0452d75b65eb52520e96b01e659';

const password = bytes(32, 0x01);
const salt = bytes(16, 0x02);
const secret = bytes(8, 0x03);
const associatedData = bytes(12, 0x04);

const options = {
  t: 3,
  m: 32,
  p: 4,
  dkLen: 32,
  version: 0x13,
  key: secret,
  personalization: associatedData,
  // maxmem is expressed in bytes; keep the test allocation explicitly bounded.
  maxmem: 1024 * 1024,
};

const derive = (pwd, s, opts) => argon2idAsync(pwd, s, opts);
let actual;
const mutationOutputs = [];
try {
  actual = await derive(password, salt, options);
  assert.equal(actual.length, 32, 'RFC 9106 output must be 32 bytes');
  assert.equal(
    toHex(actual),
    expected,
    'Argon2id output did not match RFC 9106 §5.3',
  );
  console.log('PASS: RFC 9106 §5.3 Argon2id known-answer test');

  const mutations = [
    ['password', password, { ...options }],
    ['salt', salt, { ...options }],
    ['secret K', secret, { ...options }],
    ['associated data X', associatedData, { ...options }],
  ];

  for (const [label, original, changedOptions] of mutations) {
    const changedPassword = password.slice();
    const changedSalt = salt.slice();
    const changedSecret = secret.slice();
    const changedAssociatedData = associatedData.slice();

    if (label === 'password') changedPassword[0] ^= 0x01;
    if (label === 'salt') changedSalt[0] ^= 0x01;
    if (label === 'secret K') changedOptions.key = changedSecret.map((v, i) => i === 0 ? v ^ 0x01 : v);
    if (label === 'associated data X') changedOptions.personalization = changedAssociatedData.map((v, i) => i === 0 ? v ^ 0x01 : v);

    try {
      const changed = await derive(
        changedPassword,
        changedSalt,
        {
          ...changedOptions,
          key: changedOptions.key ?? changedSecret,
          personalization: changedOptions.personalization ?? changedAssociatedData,
        },
      );
      mutationOutputs.push(changed);
      assert.notEqual(
        toHex(changed),
        expected,
        `Changing ${label} must change the Argon2id output`,
      );
      console.log(`PASS: changing ${label} changes the output`);
    } finally {
      changedPassword.fill(0);
      changedSalt.fill(0);
      changedSecret.fill(0);
      changedAssociatedData.fill(0);
    }
  }
} finally {
  // Best-effort cleanup only; JavaScript runtimes do not guarantee zeroization.
  password.fill(0);
  salt.fill(0);
  secret.fill(0);
  associatedData.fill(0);
  actual?.fill(0);
  for (const output of mutationOutputs) output.fill(0);
}
