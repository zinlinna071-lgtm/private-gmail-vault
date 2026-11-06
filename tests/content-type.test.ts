import { describe, expect, it } from "vitest";
import { isJsonContentType } from "../lib/auth/content-type";

describe("JSON content type validation", () => {
  it("accepts application/json", () => {
    expect(isJsonContentType("application/json")).toBe(true);
    expect(isJsonContentType("Application/JSON")).toBe(true);
    expect(isJsonContentType("application/json; charset=utf-8")).toBe(true);
  });

  it("rejects missing or non-JSON media types", () => {
    for (const value of [null, "", "text/plain", "application/x-www-form-urlencoded", "application/jsonp", "text/application/json"]) {
      expect(isJsonContentType(value)).toBe(false);
    }
  });
});
