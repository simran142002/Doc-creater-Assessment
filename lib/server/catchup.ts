import { createHash } from "node:crypto";
import type { BlockMeta, DocJSON, JSONNode } from "@/lib/editor/types";

const TOMBSTONE_TTL_MS = 30 * 24 * 3600 * 1000;
const TOMBSTONE_MAX = 200;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([k, v]) => k !== "id" && v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Content hash of a block, ignoring every `id` attr so stable ids never count as a change. */
export const hashBlock = (block: JSONNode) => createHash("sha1").update(stable(block)).digest("hex").slice(0, 16);

export const blockId = (block: JSONNode) => (typeof block.attrs?.id === "string" ? block.attrs.id : null);

export function computeBlockMeta(prev: BlockMeta, next: DocJSON, userId: string, now: Date): BlockMeta {
  const at = now.toISOString();
  const meta: BlockMeta = {};
  for (const block of next.content ?? []) {
    const id = blockId(block);
    if (!id) continue;
    const h = hashBlock(block);
    const old = prev[id];
    meta[id] = old && !old.del && old.h === h ? old : { h, by: userId, at };
  }
  const tombstones = Object.entries(prev)
    .filter(([id]) => !(id in meta))
    .map(([id, s]) => [id, s.del ? s : { h: s.h, by: userId, at, del: true as const }] as const)
    .filter(([, s]) => now.getTime() - Date.parse(s.at) < TOMBSTONE_TTL_MS)
    .sort(([, a], [, b]) => b.at.localeCompare(a.at))
    .slice(0, TOMBSTONE_MAX);
  for (const [id, s] of tombstones) meta[id] = s;
  return meta;
}

export type CatchUp = {
  since: string;
  changedIds: string[];
  removedCount: number;
  editors: { id: string; count: number }[];
  /** Who last changed each changed block, for the margin avatars. */
  authors: Record<string, string>;
};

/** Blocks changed by someone else since my last visit. `null` on first visit. */
export function catchUpFor(meta: BlockMeta, lastSeenAt: Date | null, userId: string): CatchUp | null {
  if (!lastSeenAt) return null;
  const since = lastSeenAt.toISOString();
  const fresh = Object.entries(meta).filter(([, s]) => s.by !== userId && Date.parse(s.at) > lastSeenAt.getTime());
  const counts = new Map<string, number>();
  for (const [, s] of fresh) counts.set(s.by, (counts.get(s.by) ?? 0) + 1);
  return {
    since,
    changedIds: fresh.filter(([, s]) => !s.del).map(([id]) => id),
    removedCount: fresh.filter(([, s]) => s.del).length,
    editors: [...counts].map(([id, count]) => ({ id, count })),
    authors: Object.fromEntries(fresh.filter(([, s]) => !s.del).map(([id, s]) => [id, s.by])),
  };
}
