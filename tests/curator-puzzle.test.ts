import { describe, expect, it } from "vitest";
import { isValidCuratorSolution } from "@/lib/auth/curator-puzzle";

describe("The Curator's Signal solution validation", () => {
  const marks = ["margin", "shelf", "note"];
  const order = ["email", "backup", "note", "password"];

  it("accepts the exact expected marks and fourfold order", () => {
    expect(isValidCuratorSolution(marks, order)).toBe(true);
  });

  it("rejects missing or extra archive marks", () => {
    expect(isValidCuratorSolution(["margin", "shelf"], order)).toBe(false);
    expect(isValidCuratorSolution([...marks, "unknown"], order)).toBe(false);
  });

  it("rejects duplicate marks", () => {
    expect(isValidCuratorSolution(["margin", "margin", "note"], order)).toBe(false);
  });

  it("rejects an incorrect or incomplete ring order", () => {
    expect(isValidCuratorSolution(marks, ["email", "password", "backup", "note"])).toBe(false);
    expect(isValidCuratorSolution(marks, ["email", "backup", "note"])).toBe(false);
  });

  it("rejects malformed non-array input", () => {
    expect(isValidCuratorSolution(null, order)).toBe(false);
    expect(isValidCuratorSolution(marks, "email,backup,note,password")).toBe(false);
  });
});
