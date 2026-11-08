# Server Ciphertext Envelope Validator

**Status:** Isolated validation primitive and tests only. Active CRUD routes remain legacy server-readable.
**Production impact:** None. No route behavior, database, secret, or deployment changes.

The server-side Zod schemas validate the future v1 opaque record envelope without decrypting it. They enforce exact object keys, protocol version and algorithm, canonical Base64, 12-byte nonce, 16-byte authentication tag, non-empty ciphertext bounded to 20,000 decoded bytes, and UUID record IDs.

The helper is intentionally separate from the active API routes. Do not switch POST/GET/PUT until the browser Worker, UI integration, wrapped-key profile lifecycle, explicit legacy-data strategy, and ciphertext-only route rollout are implemented together.

Tests cover valid envelopes, unknown fields, unsupported versions/algorithms, malformed and non-canonical Base64, nonce/tag lengths, empty/oversized ciphertext, UUID validation, and rejection of plaintext-shaped contracts.

This validator does not establish confidentiality. The current routes still accept plaintext fields and decrypt records on the server.
