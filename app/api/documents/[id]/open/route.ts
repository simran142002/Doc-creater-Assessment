import { NextResponse } from "next/server";
import { openDocument } from "@/lib/server/documents";
import { authed } from "@/lib/server/http";

export const POST = authed<{ id: string }>(async (_req, user, { id }) => NextResponse.json(await openDocument(user.id, id)));
