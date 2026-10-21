import type { DocJSON } from "./types";

/** `done` = the reader reached the end (Done) or chose "Mark as read". */
export type CatchUpNav = { ids: string[]; index: number; done: false | "seen" | "skipped" };

export type CatchUpAction =
  | { type: "next" }
  | { type: "prev" }
  | { type: "goto"; index: number }
  | { type: "dismiss" }
  | { type: "reset"; ids: string[] };

/** Changed ids in document order, dropping ids no longer in the doc. */
export function orderChangedIds(doc: DocJSON, changedIds: string[]): string[] {
  const wanted = new Set(changedIds);
  return (doc.content ?? [])
    .map((b) => b.attrs?.id)
    .filter((id): id is string => typeof id === "string" && wanted.has(id));
}

/** Opens on the first change, as in the prototype ("1 of 3"). */
export const initNav = (ids: string[]): CatchUpNav => ({ ids, index: ids.length ? 0 : -1, done: false });

const clamp = (s: CatchUpNav, i: number) => Math.min(Math.max(i, 0), s.ids.length - 1);

export function navReducer(s: CatchUpNav, a: CatchUpAction): CatchUpNav {
  if (a.type === "reset") return initNav(a.ids);
  if (a.type === "dismiss") return { ...s, done: s.done || "skipped" };
  if (!s.ids.length || s.done) return s;
  switch (a.type) {
    case "next": return s.index >= s.ids.length - 1 ? { ...s, done: "seen" } : { ...s, index: s.index + 1 };
    case "prev": return { ...s, index: clamp(s, s.index - 1) };
    case "goto": return { ...s, index: clamp(s, a.index) };
  }
}

export function navView(s: CatchUpNav) {
  const total = s.ids.length;
  return {
    total,
    position: s.index + 1,
    activeId: s.index >= 0 && !s.done ? s.ids[s.index] : null,
    hasPrev: s.index > 0,
    isLast: s.index >= total - 1,
    allCaughtUp: !!s.done || total === 0,
    skipped: s.done === "skipped",
    label: `${Math.min(s.index + 1, total)} of ${total}`,
  };
}
