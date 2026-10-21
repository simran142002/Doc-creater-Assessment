import { notFound } from "next/navigation";
import { getDocument } from "@/lib/server/documents";
import { AppError } from "@/lib/server/errors";
import { requirePageUser, toJson } from "@/lib/server/page";
import { listMembers } from "@/lib/server/shares";
import type { DocPayload, Member, User } from "@/lib/client/types";
import { DocumentView } from "./document-view";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DocPage({ params, searchParams }: Props) {
  const user = await requirePageUser();
  const { id } = await params;
  const isNew = (await searchParams).new === "1";
  const payload = await getDocument(user.id, id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const members = (await listMembers(user.id, id)).map((m): Member => ({ userId: m.userId, name: m.name, email: m.email, role: m.role, note: m.note ?? null }));
  return <DocumentView key={id} user={toJson<User>(user)} payload={toJson<DocPayload>(payload)} members={members} isNew={isNew} />;
}
