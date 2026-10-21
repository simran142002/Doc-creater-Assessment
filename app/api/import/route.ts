import { NextResponse } from "next/server";
import { createDocument } from "@/lib/server/documents";
import { AppError } from "@/lib/server/errors";
import { authed } from "@/lib/server/http";
import { parseUpload } from "@/lib/server/import";
import { LIMITS } from "@/lib/server/limits";

/** Creates the doc straight away and returns a fidelity report; the client's Undo is DELETE /api/documents/:id. */
export const POST = authed(async (req, user) => {
  if (Number(req.headers.get("content-length") ?? 0) > LIMITS.uploadBytes + 64 * 1024)
    throw new AppError("PAYLOAD_TOO_LARGE", "Files must be 2 MB or smaller.");
  const form = await req.formData().catch(() => {
    throw new AppError("VALIDATION", "Send the file as multipart/form-data in a `file` field.");
  });
  const files = form.getAll("file");
  if (files.length > 1) throw new AppError("VALIDATION", "Import one file at a time.");
  const [file] = files;
  if (!(file instanceof File)) throw new AppError("VALIDATION", "Send the file as multipart/form-data in a `file` field.");
  const parsed = await parseUpload({ name: file.name, type: file.type, bytes: Buffer.from(await file.arrayBuffer()) });
  const doc = await createDocument(user.id, { title: parsed.title, content: parsed.content, source: "import" });
  return NextResponse.json({ doc, report: parsed.report }, { status: 201 });
});
