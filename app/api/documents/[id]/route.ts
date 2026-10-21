import { NextResponse } from "next/server";
import { deleteDocument, getDocument, saveDocument } from "@/lib/server/documents";
import { authed, noContent, readJson } from "@/lib/server/http";
import { patchDocBody } from "@/lib/validation/schemas";

type P = { id: string };

export const GET = authed<P>(async (_req, user, { id }) => NextResponse.json(await getDocument(user.id, id)));

export const PATCH = authed<P>(async (req, user, { id }) => {
  const body = await readJson(req, patchDocBody);
  return NextResponse.json(await saveDocument(user.id, id, body));
});

export const DELETE = authed<P>(async (_req, user, { id }) => {
  await deleteDocument(user.id, id);
  return noContent();
});
