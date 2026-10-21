import { NextResponse } from "next/server";
import { markNoteSeen } from "@/lib/server/documents";
import { authed } from "@/lib/server/http";

export const POST = authed<{ id: string }>(async (_req, user, { id }) => {
  await markNoteSeen(user.id, id);
  return new NextResponse(null, { status: 204 });
});
