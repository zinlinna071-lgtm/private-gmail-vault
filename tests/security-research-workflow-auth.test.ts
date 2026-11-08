import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createSupabaseServerClient: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient
}));

import { getResearchActor } from "@/lib/security-research/workflow-auth";

const ownerId = "11111111-1111-4111-8111-111111111111";
const secondaryId = "22222222-2222-4222-8222-222222222222";
const reviewerId = "33333333-3333-4333-8333-333333333333";
const originalOwnerId = process.env.SECURITY_RESEARCH_OWNER_USER_ID;
const originalReviewerIds = process.env.SECURITY_RESEARCH_REVIEWER_USER_IDS;

describe("private research role boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SECURITY_RESEARCH_OWNER_USER_ID = ownerId;
    delete process.env.SECURITY_RESEARCH_REVIEWER_USER_IDS;
    mocks.getUser.mockResolvedValue({ data: { user: { id: ownerId } }, error: null });
    mocks.createSupabaseServerClient.mockResolvedValue({
      auth: { getUser: mocks.getUser }
    });
  });

  afterEach(() => {
    if (originalOwnerId === undefined) delete process.env.SECURITY_RESEARCH_OWNER_USER_ID;
    else process.env.SECURITY_RESEARCH_OWNER_USER_ID = originalOwnerId;
    if (originalReviewerIds === undefined) delete process.env.SECURITY_RESEARCH_REVIEWER_USER_IDS;
    else process.env.SECURITY_RESEARCH_REVIEWER_USER_IDS = originalReviewerIds;
  });

  it("recognizes only the configured Master/Owner account as Owner", async () => {
    const actor = await getResearchActor();

    expect(actor).toEqual({ id: ownerId, isOwner: true, isReviewer: false });
  });

  it("does not grant a normal Secondary account Owner or reviewer privileges", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: secondaryId } }, error: null });

    const actor = await getResearchActor();

    expect(actor).toEqual({ id: secondaryId, isOwner: false, isReviewer: false });
  });

  it("grants reviewer status only to explicitly configured reviewer IDs", async () => {
    process.env.SECURITY_RESEARCH_REVIEWER_USER_IDS = reviewerId;
    mocks.getUser.mockResolvedValue({ data: { user: { id: reviewerId } }, error: null });

    const actor = await getResearchActor();

    expect(actor).toEqual({ id: reviewerId, isOwner: false, isReviewer: true });
  });

  it("fails closed when Owner identity is not configured", async () => {
    delete process.env.SECURITY_RESEARCH_OWNER_USER_ID;

    await expect(getResearchActor()).resolves.toBeNull();
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("fails closed when there is no verified authenticated user", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(getResearchActor()).resolves.toBeNull();
  });

  it("fails closed when Supabase cannot verify the session", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error("session unavailable") });

    await expect(getResearchActor()).resolves.toBeNull();
  });
});
