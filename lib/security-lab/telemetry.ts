import { z } from "zod";

/**
 * Safe, bounded telemetry contract for real Security Lab executions.
 * Deliberately excludes request/response bodies, credentials, tokens, keys,
 * arbitrary metadata, and attacker-controlled URLs.
 */
export const SECURITY_LAB_EVENT_SCHEMA_VERSION = 1 as const;

export const securityLabEventSchema = z.object({
  schemaVersion: z.literal(SECURITY_LAB_EVENT_SCHEMA_VERSION),
  eventId: z.string().uuid(),
  runId: z.string().uuid(),
  occurredAt: z.string().datetime({ offset: true }),
  source: z.enum(["unit", "integration", "browser", "ci"]),
  module: z.enum([
    "authentication",
    "session",
    "kdf",
    "encryption",
    "authorization",
    "api",
    "browser",
    "recovery"
  ]),
  eventType: z.enum([
    "test.started",
    "request.observed",
    "control.allowed",
    "control.blocked",
    "finding.detected",
    "test.completed"
  ]),
  outcome: z.enum(["info", "pass", "fail", "blocked"]),
  durationMs: z.number().int().min(0).max(300_000).optional(),
  bytesIn: z.number().int().min(0).max(1_048_576).optional(),
  bytesOut: z.number().int().min(0).max(1_048_576).optional(),
  fixtureId: z.string().regex(/^synthetic:[a-z0-9._-]{1,64}$/),
  controlId: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/).optional()
}).strict();

export type SecurityLabEvent = z.infer<typeof securityLabEventSchema>;

export const securityLabEventBatchSchema = z.array(securityLabEventSchema).min(1).max(500);

export function parseSecurityLabEvent(value: unknown): SecurityLabEvent {
  return securityLabEventSchema.parse(value);
}

export function parseSecurityLabEventBatch(value: unknown): SecurityLabEvent[] {
  const events = securityLabEventBatchSchema.parse(value);
  const ids = new Set<string>();
  for (const event of events) {
    if (ids.has(event.eventId)) {
      throw new Error("Duplicate security lab event ID");
    }
    ids.add(event.eventId);
  }
  return events;
}
