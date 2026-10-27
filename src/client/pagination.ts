export interface PaginationHint {
  hasMore: boolean;
  nextOffset: number;
  totalCount: number;
  returned: number;
}

interface PageEnvelope {
  data: unknown[];
  offset: number;
  limit: number;
  count: number;
  totalCount: number;
}

function isEnvelope(x: unknown): x is PageEnvelope {
  if (x === null || typeof x !== "object" || Array.isArray(x)) return false;
  const r = x as Record<string, unknown>;
  return (
    Array.isArray(r.data) &&
    typeof r.offset === "number" &&
    typeof r.limit === "number" &&
    typeof r.count === "number" &&
    typeof r.totalCount === "number"
  );
}

export function parsePaginationHint(body: unknown): PaginationHint | null {
  if (!isEnvelope(body)) return null;
  const next = body.offset + body.count;
  if (next >= body.totalCount) return null;
  return { hasMore: true, nextOffset: next, totalCount: body.totalCount, returned: body.count };
}
