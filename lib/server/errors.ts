export type ErrorCode =
  | "VALIDATION" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "STALE_VERSION" | "CONFLICT"
  | "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_TYPE" | "INVALID_CONTENT" | "EMPTY_FILE"
  | "CORRUPT_FILE" | "SELF_SHARE" | "USER_NOT_FOUND" | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400, UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, STALE_VERSION: 409, CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413, UNSUPPORTED_TYPE: 415, INVALID_CONTENT: 422, EMPTY_FILE: 422,
  CORRUPT_FILE: 422, SELF_SHARE: 422, USER_NOT_FOUND: 422, INTERNAL: 500,
};

export class AppError extends Error {
  readonly status: number;
  constructor(readonly code: ErrorCode, message: string, readonly details?: unknown) {
    super(message);
    this.status = STATUS[code];
  }
}

export const notFound = () => new AppError("NOT_FOUND", "Document not found.");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

/** Postgres SQLSTATEs that mean "bad or racing input", not a server fault. Drizzle wraps driver errors in `cause`. */
const PG: Record<string, [ErrorCode, string]> = {
  "23505": ["CONFLICT", "That already exists."],
  "23503": ["NOT_FOUND", "Something this request refers to no longer exists."],
  "23514": ["VALIDATION", "A value is outside the allowed limits."],
  "22001": ["VALIDATION", "A value is too long."],
  "22P02": ["VALIDATION", "A value has the wrong format."],
  "22021": ["VALIDATION", "Text contains invalid characters."],
  "22P05": ["VALIDATION", "Text contains invalid characters."],
};

export function fromDbError(e: unknown): AppError | null {
  for (let c = e as { code?: unknown; cause?: unknown } | undefined, i = 0; c && i < 3; c = c.cause as typeof c, i++) {
    const hit = typeof c.code === "string" ? PG[c.code] : undefined;
    if (hit) return new AppError(...hit);
  }
  return null;
}
