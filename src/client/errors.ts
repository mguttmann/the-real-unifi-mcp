export interface UnifiErrorPayload {
  statusCode: number;
  statusName?: string;
  code?: string;
  message: string;
  details?: unknown;
}

export class UnifiApiError extends Error {
  readonly statusCode: number;
  readonly statusName: string | undefined;
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(p: UnifiErrorPayload) {
    super(`[${p.statusCode}${p.statusName ? " " + p.statusName : ""}] ${p.message}`);
    this.name = "UnifiApiError";
    this.statusCode = p.statusCode;
    this.statusName = p.statusName;
    this.code = p.code;
    this.details = p.details;
  }
}

export function parseApiError(body: string, status: number): UnifiApiError {
  try {
    const parsed = JSON.parse(body) as Partial<UnifiErrorPayload>;
    if (parsed && typeof parsed === "object" && typeof parsed.message === "string") {
      return new UnifiApiError({
        statusCode: typeof parsed.statusCode === "number" ? parsed.statusCode : status,
        statusName: parsed.statusName,
        code: parsed.code,
        message: parsed.message,
        details: parsed.details,
      });
    }
  } catch {
    // fall through
  }
  return new UnifiApiError({
    statusCode: status,
    message: `HTTP ${status}${body ? `: ${body.slice(0, 200)}` : ""}`,
  });
}
