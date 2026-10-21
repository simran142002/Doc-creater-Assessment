import { NextResponse } from "next/server";
import { authed, readJson } from "@/lib/server/http";
import { listMembers, upsertShare } from "@/lib/server/shares";
import { shareBody } from "@/lib/validation/schemas";

type P = { id: string };

export const GET = authed<P>(async (_req, user, { id }) => NextResponse.json(await listMembers(user.id, id)));

export const PUT = authed<P>(async (req, user, { id }) => {
  const body = await readJson(req, shareBody);
  const { created, share } = await upsertShare(user.id, id, body);
  return NextResponse.json(share, { status: created ? 201 : 200 });
});
