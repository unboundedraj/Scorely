import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("safeNext", () => {
  it("allows same-origin relative paths", () => {
    expect(safeNext("/live")).toBe("/live");
    expect(safeNext("/match/abc?tab=score#top")).toBe("/match/abc?tab=score#top");
  });

  it("falls back for missing or empty values", () => {
    expect(safeNext(null)).toBe("/matches");
    expect(safeNext(undefined)).toBe("/matches");
    expect(safeNext("")).toBe("/matches");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNext("https://evil.com")).toBe("/matches");
    expect(safeNext("//evil.com")).toBe("/matches");
    expect(safeNext(`/${String.fromCharCode(92)}evil.com`)).toBe("/matches");
  });

  it("rejects paths that do not start with a slash", () => {
    expect(safeNext("matches")).toBe("/matches");
    expect(safeNext("javascript:alert(1)")).toBe("/matches");
  });

  it("uses a custom fallback when given", () => {
    expect(safeNext("//evil.com", "/")).toBe("/");
    expect(safeNext(null, "/home")).toBe("/home");
  });
});
