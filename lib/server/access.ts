import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { documents, shares, type Role } from "@/lib/db/schema";
import { AppError, isUuid, notFound } from "./errors";

export type Action = "read" | "write" | "share" | "delete";

const MATRIX: Record<Role, Action[]> = {
  owner: ["read", "write", "share", "delete"],
  editor: ["read", "write"],
  viewer: ["read"],
};

export const can = (role: Role | null, action: Action) => !!role && MATRIX[role].includes(action);

export async function getAccess(userId: string, docId: string): Promise<Role | null> {
  if (!isUuid(docId)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ ownerId: documents.ownerId, role: shares.role })
    .from(documents)
    .leftJoin(shares, and(eq(shares.documentId, documents.id), eq(shares.userId, userId)))
    .where(eq(documents.id, docId));
  if (!row) return null;
  return row.ownerId === userId ? "owner" : row.role;
}

/** Strangers get 404 (existence is not revealed); members lacking the role get 403. */
export async function assertCan(userId: string, docId: string, action: Action): Promise<Role> {
  const role = await getAccess(userId, docId);
  if (!role) throw notFound();
  if (!can(role, action)) throw new AppError("FORBIDDEN", `Your role (${role}) cannot ${action} this document.`);
  return role;
}
