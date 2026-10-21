import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { documents, shares, users, type Role } from "@/lib/db/schema";
import { assertCan } from "./access";
import { cleanNote } from "./content";
import { AppError, isUuid } from "./errors";

export type Member = { userId: string; name: string; email: string; role: Role; note?: string | null; noteSeenAt?: Date | null };

/** Everyone with access, owner first. Any member may list; only the owner sees notes (non-owners get id/name/email/role). */
export async function listMembers(userId: string, docId: string): Promise<Member[]> {
  const myRole = await assertCan(userId, docId, "read");
  const db = await getDb();
  const [owner] = await db.select({ userId: users.id, name: users.name, email: users.email })
    .from(documents).innerJoin(users, eq(users.id, documents.ownerId)).where(eq(documents.id, docId));
  const rows = await db
    .select({ userId: users.id, name: users.name, email: users.email, role: shares.role, note: shares.note, noteSeenAt: shares.noteSeenAt })
    .from(shares)
    .innerJoin(users, eq(users.id, shares.userId))
    .where(eq(shares.documentId, docId))
    .orderBy(asc(shares.createdAt));
  if (myRole !== "owner") return [{ ...owner, role: "owner" }, ...rows.map(({ userId, name, email, role }) => ({ userId, name, email, role }))];
  return [{ ...owner, role: "owner", note: null, noteSeenAt: null }, ...rows];
}

export type ShareInput = { email: string; role: "viewer" | "editor"; note?: string | null };

/** Re-sharing updates role (and note, when given). A changed note becomes unread again. */
export async function upsertShare(userId: string, docId: string, input: ShareInput) {
  await assertCan(userId, docId, "share");
  const db = await getDb();
  const email = input.email.trim().toLowerCase();
  const [target] = await db.select().from(users).where(eq(users.email, email));
  if (!target) throw new AppError("USER_NOT_FOUND", `No user with email ${email}.`);
  if (target.id === userId) throw new AppError("SELF_SHARE", "You already own this document.");

  const note = input.note == null ? input.note : cleanNote(input.note);
  const now = new Date();
  const [row] = await db
    .insert(shares)
    .values({ documentId: docId, userId: target.id, role: input.role, note: note ?? null })
    .onConflictDoUpdate({
      target: [shares.documentId, shares.userId],
      set: {
        role: input.role,
        updatedAt: now,
        ...(note !== undefined && {
          note,
          noteSeenAt: sql`CASE WHEN ${shares.note} IS DISTINCT FROM excluded.note THEN NULL ELSE ${shares.noteSeenAt} END`,
        }),
      },
    })
    .returning({ role: shares.role, note: shares.note, noteSeenAt: shares.noteSeenAt, created: sql<boolean>`(xmax = 0)` });
  const { created, ...share } = row;
  return { created, share: { userId: target.id, name: target.name, email: target.email, ...share } };
}

/** Revoking someone without access is 404 (not idempotent), so a stale share list surfaces instead of silently succeeding. */
export async function revokeShare(userId: string, docId: string, targetUserId: string) {
  await assertCan(userId, docId, "share");
  if (targetUserId === userId) throw new AppError("VALIDATION", "The owner's access can't be removed.");
  const noAccess = new AppError("NOT_FOUND", "That user has no access to this document.");
  if (!isUuid(targetUserId)) throw noAccess;
  const db = await getDb();
  const deleted = await db.delete(shares)
    .where(and(eq(shares.documentId, docId), eq(shares.userId, targetUserId)))
    .returning({ userId: shares.userId });
  if (!deleted.length) throw noAccess;
}
