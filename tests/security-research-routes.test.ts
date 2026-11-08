import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getResearchActor: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  isSameOriginRequest: vi.fn(),
  isJsonContentType: vi.fn(),
  readBoundedJson: vi.fn()
}));

vi.mock("@/lib/security-research/workflow-auth", () => ({
  getResearchActor: mocks.getResearchActor
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient
}));
vi.mock("@/lib/auth/vault", () => ({
  isSameOriginRequest: mocks.isSameOriginRequest
}));
vi.mock("@/lib/auth/content-type", () => ({
  isJsonContentType: mocks.isJsonContentType
}));
vi.mock("@/lib/auth/bounded-json", () => ({
  readBoundedJson: mocks.readBoundedJson
}));

import { GET as listDrafts, POST as createDraft } from "@/app/api/security/research/drafts/route";
import { GET as getDraft, PATCH as updateDraft } from "@/app/api/security/research/drafts/[id]/route";
import { POST as submitReview } from "@/app/api/security/research/review/route";

const secondaryId = "22222222-2222-4222-8222-222222222222";
const reviewerId = "33333333-3333-4333-8333-333333333333";
const draftId = "44444444-4444-4444-8444-444444444444";

function request(method: string, body?: unknown) {
  return new Request("https://vault.example/api/security/research/drafts", {
    method,
    headers: {
      Origin: "https://vault.example",
      "Sec-Fetch-Site": "same-origin",
      "Content-Type": "application/json"
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

describe("private research route authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getResearchActor.mockResolvedValue({
      id: secondaryId,
      isOwner: false,
      isReviewer: false
    });
    mocks.createSupabaseAdminClient.mockReturnValue({});
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.isJsonContentType.mockReturnValue(true);
    mocks.readBoundedJson.mockImplementation(async (req: Request) => ({
      ok: true,
      value: await req.json()
    }));
  });

  it("does not allow a Secondary account to list private research drafts", async () => {
    const response = await listDrafts();

    expect(response.status).toBe(403);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("does not allow a Secondary account to open a private draft", async () => {
    const response = await getDraft(request("GET"), {
      params: Promise.resolve({ id: draftId })
    });

    expect(response.status).toBe(401);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("does not allow a Secondary account to create a research draft", async () => {
    const response = await createDraft(request("POST"));

    expect(response.status).toBe(403);
    expect(mocks.readBoundedJson).not.toHaveBeenCalled();
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("does not allow a reviewer account to create an Owner research draft", async () => {
    mocks.getResearchActor.mockResolvedValue({
      id: reviewerId,
      isOwner: false,
      isReviewer: true
    });

    const response = await createDraft(request("POST"));

    expect(response.status).toBe(403);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("does not allow a reviewer account to edit an Owner research draft", async () => {
    mocks.getResearchActor.mockResolvedValue({
      id: reviewerId,
      isOwner: false,
      isReviewer: true
    });

    const response = await updateDraft(request("PATCH"), {
      params: Promise.resolve({ id: draftId })
    });

    expect(response.status).toBe(403);
    expect(mocks.readBoundedJson).not.toHaveBeenCalled();
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("does not allow a reviewer to submit final Owner approval", async () => {
    mocks.getResearchActor.mockResolvedValue({
      id: reviewerId,
      isOwner: false,
      isReviewer: true
    });

    const response = await submitReview(request("POST", {
      draftId,
      stage: "owner",
      decision: "approved",
      notes: "The paper is ready for final publication approval."
    }));

    expect(response.status).toBe(403);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("does not allow a Secondary account to submit any review stage", async () => {
    const response = await submitReview(request("POST", {
      draftId,
      stage: "technical",
      decision: "approved",
      notes: "The technical method and evidence have been reviewed."
    }));

    expect(response.status).toBe(403);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
