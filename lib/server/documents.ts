import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db/client";
import { documents, documentViews, shares, users, type Role } from "@/lib/db/schema";
import type { DocJSON } from "@/lib/editor/types";
import { assertCan } from "./access";
import { catchUpFor, computeBlockMeta, type CatchUp } from "./catchup";
import { cleanTitle, emptyDoc, validateDoc } from "./content";
import { AppError, notFound } from "./errors";
import { DEFAULT_TITLE } from "./limits";

const owner = alias(users, "owner");
const editor = alias(users, "editor");

const docColumns = {
  id: documents.id,
  title: documents.title,
  content: documents.content,
  blockMeta: documents.blockMeta,
  version: documents.version,
  source: documents.source,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
  owner: { id: owner.id, name: owner.name },
  lastEditedById: documents.lastEditedBy,
  lastEditedByName: editor.name,
};

async function loadDoc(docId: string) {
  const db = await getDb();
  const [row] = await db
    .select(docColumns)
    .from(documents)
    .innerJoin(owner, eq(owner.id, documents.ownerId))
    .leftJoin(editor, eq(editor.id, documents.lastEditedBy))
    .where(eq(documents.id, docId));
  if (!row) throw notFound();
  return row;
}

type DocRow = Awaited<ReturnType<typeof loadDoc>>;

function toDto(row: DocRow) {
  const { blockMeta: _meta, lastEditedById, lastEditedByName, ...rest } = row;
  void _meta;
  return { ...rest, lastEditedBy: lastEditedById ? { id: lastEditedById, name: lastEditedByName ?? "" } : null };
}

export type DocDTO = ReturnType<typeof toDto>;

async function nameMap(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const db = await getDb();
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}

async function withNames(c: CatchUp | null) {
  if (!c) return null;
  const names = await nameMap(c.editors.map((e) => e.id));
  return { ...c, editors: c.editors.map((e) => ({ ...e, name: names.get(e.id) ?? "Someone" })) };
}

async function viewState(userId: string, docId: string) {
  const db = await getDb();
  const [view] = await db.select().from(documentViews)
    .where(and(eq(documentViews.userId, userId), eq(documentViews.documentId, docId)));
  const [share] = await db.select().from(shares).where(and(eq(shares.userId, userId), eq(shares.documentId, docId)));
  return { lastSeenAt: view?.lastSeenAt ?? null, share };
}

export async function getDocument(userId: string, docId: string) {
  const role = await assertCan(userId, docId, "read");
  const row = await loadDoc(docId);
  const { lastSeenAt, share } = await viewState(userId, docId);
  const catchUp = await withNames(catchUpFor(row.blockMeta, lastSeenAt, userId));
  const handoff = share?.note
    ? { note: share.note, from: row.owner, unread: share.noteSeenAt === null, sharedAt: share.updatedAt }
    : null;
  return { doc: toDto(row), role, catchUp, handoff };
}

/** Returns the same payload as GET (computed before the visit), then records the visit. */
export async function openDocument(userId: string, docId: string) {
  const result = await getDocument(userId, docId);
  const db = await getDb();
  const now = new Date();
  await db.insert(documentViews).values({ userId, documentId: docId, lastSeenAt: now })
    .onConflictDoUpdate({ target: [documentViews.userId, documentViews.documentId], set: { lastSeenAt: now } });
  return result;
}

export async function markNoteSeen(userId: string, docId: string) {
  await assertCan(userId, docId, "read");
  const db = await getDb();
  await db.update(shares).set({ noteSeenAt: new Date() }).where(and(eq(shares.userId, userId), eq(shares.documentId, docId)));
}

export async function createDocument(
  userId: string,
  input: { title?: string; content?: unknown; source?: "blank" | "import" },
) {
  const content = validateDoc(input.content ?? emptyDoc());
  const now = new Date();
  const db = await getDb();
  const [doc] = await db.insert(documents).values({
    ownerId: userId,
    title: cleanTitle(input.title ?? "", DEFAULT_TITLE),
    content,
    blockMeta: computeBlockMeta({}, content, userId, now),
    lastEditedBy: userId,
    source: input.source ?? "blank",
    createdAt: now,
    updatedAt: now,
  }).returning({ id: documents.id });
  await db.insert(documentViews).values({ userId, documentId: doc.id, lastSeenAt: now });
  return toDto(await loadDoc(doc.id));
}

async function staleError(docId: string) {
  const current = toDto(await loadDoc(docId));
  return new AppError("STALE_VERSION", `${current.lastEditedBy?.name ?? "Someone"} saved a newer version of this document.`, {
    current: { version: current.version, updatedAt: current.updatedAt, updatedBy: current.lastEditedBy, doc: current },
  });
}

export type SaveInput = { title?: string; content?: unknown; baseVersion?: number; force?: boolean };

const saved = { version: documents.version, updatedAt: documents.updatedAt, title: documents.title };

/**
 * Content saves are optimistic: `UPDATE … WHERE version = base`, so of two saves on the same base exactly one wins.
 * `force` (Keep mine) retries the compare-and-swap a few times instead of losing to a save that lands mid-request.
 * Title is last-write-wins and never bumps the version.
 */
export async function saveDocument(userId: string, docId: string, input: SaveInput) {
  await assertCan(userId, docId, "write");
  const db = await getDb();
  const now = new Date();
  const title = input.title === undefined ? undefined : cleanTitle(input.title, DEFAULT_TITLE);

  if (input.content === undefined) {
    if (title === undefined) throw new AppError("VALIDATION", "Nothing to update.");
    const [row] = await db.update(documents).set({ title, lastEditedBy: userId, updatedAt: now })
      .where(eq(documents.id, docId)).returning(saved);
    if (!row) throw notFound();
    return row;
  }

  const content = validateDoc(input.content) as DocJSON;
  for (let attempt = 0; attempt < 3; attempt++) {
    const [cur] = await db.select({ version: documents.version, blockMeta: documents.blockMeta })
      .from(documents).where(eq(documents.id, docId));
    if (!cur) throw notFound();
    if (!input.force && cur.version !== input.baseVersion) break;
    const [row] = await db.update(documents)
      .set({
        content,
        blockMeta: computeBlockMeta(cur.blockMeta, content, userId, now),
        version: sql`${documents.version} + 1`,
        lastEditedBy: userId,
        updatedAt: now,
        ...(title !== undefined && { title }),
      })
      .where(and(eq(documents.id, docId), eq(documents.version, cur.version)))
      .returning(saved);
    if (row) return row;
    if (!input.force) break;
  }
  throw await staleError(docId);
}

export async function deleteDocument(userId: string, docId: string) {
  await assertCan(userId, docId, "delete");
  const db = await getDb();
  await db.delete(documents).where(eq(documents.id, docId));
}

export type DocCard = {
  id: string;
  title: string;
  updatedAt: Date;
  source: "blank" | "import";
  role: Role;
  owner: { id: string; name: string };
  lastEditedBy: { id: string; name: string } | null;
  newForYou: { changedBlocks: number; unreadNote: boolean; neverOpened: boolean };
  handoffNote: string | null;
};

export async function listDocuments(userId: string): Promise<{ owned: DocCard[]; shared: DocCard[] }> {
  const db = await getDb();
  const rows = await db
    .select({
      ...docColumns,
      shareRole: shares.role,
      note: shares.note,
      noteSeenAt: shares.noteSeenAt,
      lastSeenAt: documentViews.lastSeenAt,
    })
    .from(documents)
    .innerJoin(owner, eq(owner.id, documents.ownerId))
    .leftJoin(editor, eq(editor.id, documents.lastEditedBy))
    .leftJoin(shares, and(eq(shares.documentId, documents.id), eq(shares.userId, userId)))
    .leftJoin(documentViews, and(eq(documentViews.documentId, documents.id), eq(documentViews.userId, userId)))
    .where(sql`${documents.ownerId} = ${userId} OR ${shares.userId} = ${userId}`)
    .orderBy(desc(documents.updatedAt));

  const cards = rows.map((r): DocCard => {
    const catchUp = catchUpFor(r.blockMeta, r.lastSeenAt, userId);
    const isOwner = r.owner.id === userId;
    return {
      id: r.id,
      title: r.title,
      updatedAt: r.updatedAt,
      source: r.source,
      role: isOwner ? "owner" : r.shareRole!,
      owner: r.owner,
      lastEditedBy: r.lastEditedById ? { id: r.lastEditedById, name: r.lastEditedByName ?? "" } : null,
      newForYou: {
        changedBlocks: catchUp ? catchUp.changedIds.length + catchUp.removedCount : 0,
        unreadNote: !!r.note && r.noteSeenAt === null,
        neverOpened: !r.lastSeenAt,
      },
      handoffNote: isOwner ? null : r.note,
    };
  });
  return { owned: cards.filter((c) => c.role === "owner"), shared: cards.filter((c) => c.role !== "owner") };
}
