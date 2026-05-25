import { describe, expect, it } from "vitest";
import { parsePaginationHint } from "../../src/client/pagination.js";

describe("parsePaginationHint", () => {
  it("detects more pages when offset+count < totalCount", () => {
    const hint = parsePaginationHint({ data: [1, 2, 3], offset: 0, limit: 3, count: 3, totalCount: 10 });
    expect(hint).toEqual({ hasMore: true, nextOffset: 3, totalCount: 10, returned: 3 });
  });

  it("returns null when totalCount is reached", () => {
    expect(parsePaginationHint({ data: [], offset: 9, limit: 1, count: 1, totalCount: 10 })).toBeNull();
  });

  it("returns null when envelope shape doesn't match", () => {
    expect(parsePaginationHint({ foo: "bar" })).toBeNull();
    expect(parsePaginationHint(null)).toBeNull();
    expect(parsePaginationHint([1, 2, 3])).toBeNull();
  });

  it("treats missing totalCount as no-more", () => {
    expect(parsePaginationHint({ data: [], offset: 0, limit: 10, count: 0 })).toBeNull();
  });
});
