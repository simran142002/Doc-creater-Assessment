import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { cookieOptions, SESSION_COOKIE, signSession } from "@/lib/server/auth";
import { AppError } from "@/lib/server/errors";
import { readJson, route } from "@/lib/server/http";
import { clientIp, enforce } from "@/lib/server/rate-limit";
import { sessionBody } from "@/lib/validation/schemas";

export const POST = route(async (req) => {
  await enforce("signIn", clientIp(req));
  const { userId } = await readJson(req, sessionBody);
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new AppError("NOT_FOUND", "Unknown user.");
  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, await signSession(user.id), cookieOptions);
  return res;
});

export const DELETE = route(async () => {
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
});
