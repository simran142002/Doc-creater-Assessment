import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { getDb } from "@/lib/db/client";
import { users, type User } from "@/lib/db/schema";
import { AppError, isUuid } from "./errors";

export const SESSION_COOKIE = "ajaia_session";
export const SESSION_MAX_AGE = 7 * 24 * 3600;
const DEV_SECRET = "dev-only-insecure-secret-change-me-0123456789";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build")
    throw new Error("SESSION_SECRET is required in production");
  return new TextEncoder().encode(s || DEV_SECRET);
}

export const signSession = (userId: string) =>
  new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`).sign(secret());

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return isUuid(payload.sub) ? payload.sub : null;
  } catch {
    return null;
  }
}

export function readCookie(header: string | null, name: string) {
  for (const part of header?.split(";") ?? []) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export async function userFromToken(token: string | undefined): Promise<User | null> {
  const id = await verifySession(token);
  if (!id) return null;
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user ?? null;
}

/** Identity comes only from the signed cookie, never from the request body. */
export async function requireUser(req: Request): Promise<User> {
  const user = await userFromToken(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
  if (!user) throw new AppError("UNAUTHENTICATED", "Sign in required.");
  return user;
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
