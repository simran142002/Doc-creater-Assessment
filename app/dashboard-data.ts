import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { documents, shares, users } from "@/lib/db/schema";
import type { JSONNode } from "@/lib/editor/types";
import { listDocuments, type DocCard } from "@/lib/server/documents";

const textOf = (n: JSONNode): string => n.text ?? (n.content ?? []).map(textOf).join(" ");

/** Cards plus what the dashboard draws: a thumbnail (first 7 blocks), searchable text and collaborator names. */
export async function dashboardCards(userId: string) {
  const { owned, shared } = await listDocuments(userId);
  const ids = [...owned, ...shared].map((d) => d.id);
  const ownedIds = owned.map((d) => d.id);
  const db = await getDb();
  const docs = ids.length
    ? await db.select({ id: documents.id, content: documents.content, createdAt: documents.createdAt }).from(documents).where(inArray(documents.id, ids))
    : [];
  const people = ownedIds.length
    ? await db.select({ docId: shares.documentId, name: users.name }).from(shares)
      .innerJoin(users, eq(users.id, shares.userId)).where(inArray(shares.documentId, ownedIds)).orderBy(shares.createdAt)
    : [];
  const byId = new Map(docs.map((d) => [d.id, d]));
  const extend = (c: DocCard) => {
    const d = byId.get(c.id);
    const blocks = d?.content.content ?? [];
    return {
      ...c,
      createdAt: d?.createdAt ?? c.updatedAt,
      preview: blocks.slice(0, 7),
      text: blocks.map(textOf).join(" ").slice(0, 20_000),
      collaborators: people.filter((p) => p.docId === c.id).map((p) => p.name),
    };
  };
  return { owned: owned.map(extend), shared: shared.map(extend) };
}
