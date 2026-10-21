import { NextResponse } from "next/server";
import { createDocument, listDocuments } from "@/lib/server/documents";
import { authed, readJson } from "@/lib/server/http";
import { createDocBody } from "@/lib/validation/schemas";

export const GET = authed(async (_req, user) => NextResponse.json(await listDocuments(user.id)));

export const POST = authed(async (req, user) => {
  const body = await readJson(req, createDocBody);
  return NextResponse.json(await createDocument(user.id, body), { status: 201 });
});
