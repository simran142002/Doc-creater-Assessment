import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { clientIp, enforce } from "@/lib/server/rate-limit";
import { route } from "@/lib/server/http";

// Public: the login picker needs the seeded users before a session exists.
export const GET = route(async (req) => {
  await enforce("read", `ip:${clientIp(req)}`);
  const db = await getDb();
  const rows = await db.select({ id: users.id, name: users.name, email: users.email, avatarHue: users.avatarHue }).from(users).orderBy(users.name);
  return NextResponse.json(rows);
});
