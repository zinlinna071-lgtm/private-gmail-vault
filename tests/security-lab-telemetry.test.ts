import { describe, expect, it } from "vitest";
import {
  parseSecurityLabEvent,
  parseSecurityLabEventBatch
} from "../lib/security-lab/telemetry";

function validEvent() {
  return {
    schemaVersion: 1,
    eventId: "11111111-1111-4111-8111-111111111111",
    runId: "22222222-2222-4222-8222-222222222222",
    occurredAt: "2026-11-07T02:00:00.000Z",
    source: "integration",
    module: "authorization",
    eventType: "control.blocked",
    outcome: "blocked",
    durationMs: 18,
    bytesIn: 128,
    bytesOut: 0,
    fixtureId: "synthetic:user-b"
  };
}

describe("Security Lab telemetry contract", () => {
  it("accepts a bounded event with synthetic fixture attribution", () => {
    expect(parseSecurityLabEvent(validEvent())).toEqual(validEvent());
  });

  it("rejects secret-bearing or arbitrary fields", () => {
    expect(() => parseSecurityLabEvent({
      ...validEvent(),
      requestBody: "sensitive"
    })).toThrow();
    expect(() => parseSecurityLabEvent({
      ...validEvent(),
      accessToken: "not-allowed"
    })).toThrow();
  });

  it("requires a synthetic fixture identifier", () => {
    expect(() => parseSecurityLabEvent({
      ...validEvent(),
      fixtureId: "real-user-123"
    })).toThrow();
  });

  it("bounds event counts and numeric telemetry", () => {
    expect(() => parseSecurityLabEvent({
      ...validEvent(),
      bytesIn: 1_048_577
    })).toThrow();
    expect(() => parseSecurityLabEventBatch([])).toThrow();
    expect(() => parseSecurityLabEventBatch(
      Array.from({ length: 501 }, (_, index) => ({
        ...validEvent(),
        eventId: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`
      }))
    )).toThrow();
  });

  it("rejects duplicate event IDs within one batch", () => {
    expect(() => parseSecurityLabEventBatch([
      validEvent(),
      { ...validEvent(), runId: "33333333-3333-4333-8333-333333333333" }
    ])).toThrow("Duplicate security lab event ID");
  });
});
