import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import type { User } from "@/lib/db/schema";
import { requireUser } from "./auth";
import { AppError, fromDbError } from "./errors";
import { LIMITS } from "./limits";
import { bucketFor, enforce } from "./rate-limit";

export type Ctx<P = Record<string, string>> = { params: Promise<P> };

const where = (req?: Request) => (req ? `[api] ${req.method} ${new URL(req.url).pathname}` : "[api]");

/** Known errors map to their code; anything else is logged with its stack and returned as a generic 500. */
export function errorResponse(e: unknown, req?: Request) {
  const db = fromDbError(e);
  if (db) {
    console.warn(`${where(req)} → ${db.code}`, e);
    e = db;
  }
  if (e instanceof AppError) {
    const retryAfter = (e.details as { retryAfter?: number } | undefined)?.retryAfter;
    return NextResponse.json(
      { error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } },
      { status: e.status, ...(e.code === "RATE_LIMITED" && retryAfter ? { headers: { "Retry-After": String(retryAfter) } } : {}) },
    );
  }
  if (e instanceof ZodError) {
    const issue = e.issues[0];
    return NextResponse.json(
      { error: { code: "VALIDATION", message: issue?.message ?? "Invalid request.", details: { issues: e.issues } } },
      { status: 400 },
    );
  }
  console.error(`${where(req)} failed`, e);
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong." } }, { status: 500 });
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Same-origin check for mutations (SameSite=Lax covers the rest). */
function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!MUTATING.has(req.method) || !origin) return;
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host).split(",")[0].trim();
  if (!URL.canParse(origin) || new URL(origin).host !== host) throw new AppError("FORBIDDEN", "Cross-origin request rejected.");
}

export function route<P>(fn: (req: Request, params: P) => Promise<Response>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      assertSameOrigin(req);
      return await fn(req, (await ctx?.params) as P);
    } catch (e) {
      return errorResponse(e, req);
    }
  };
}

export function authed<P>(fn: (req: Request, user: User, params: P) => Promise<Response>) {
  return route<P>(async (req, params) => {
    const user = await requireUser(req);
    await enforce(bucketFor(req), user.id);
    return fn(req, user, params);
  });
}

const BODY_MAX = LIMITS.contentBytes + 16 * 1024;
const tooLarge = () => new AppError("PAYLOAD_TOO_LARGE", "Request body is too large.");

/**
 * Reads a JSON body with a byte cap just above the 1 MB content limit. Content-Type is not enforced, so
 * `text/plain` bodies (sendBeacon / keepalive flushes) work; cross-site writes are stopped by the Origin check + SameSite.
 * Unknown fields are stripped by the Zod schemas.
 */
export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  if (Number(req.headers.get("content-length") ?? 0) > BODY_MAX) throw tooLarge();
  const text = await req.text();
  if (Buffer.byteLength(text) > BODY_MAX) throw tooLarge();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new AppError("VALIDATION", "Body must be valid JSON.");
  }
  return schema.parse(body);
}

export const noContent = () => new NextResponse(null, { status: 204 });
