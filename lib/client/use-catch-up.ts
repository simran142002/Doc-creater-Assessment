"use client";

import type { Editor } from "@tiptap/core";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { catchUpKey, type CatchUpAuthor } from "@/lib/editor/catchup-highlight";
import { api } from "./api";
import { initNav, navReducer, navView, orderChangedIds, type CatchUpAction } from "./catchup-nav";
import { avatarColor, initials } from "./format";
import type { CatchUp, DocJSON } from "./types";

const FADE_MS = 480;

/** Catch-up on by default: highlights + margin avatars, Prev/Next, then "all caught up". Records the visit via POST /open once per mount. */
export function useCatchUp({ editor, docId, content, catchUp }: {
  editor: Editor | null;
  docId: string;
  content: DocJSON;
  catchUp: CatchUp | null;
}) {
  const ids = useMemo(() => orderChangedIds(content, catchUp?.changedIds ?? []), [content, catchUp]);
  const [nav, dispatch] = useReducer(navReducer, ids, initNav);
  const [fading, setFading] = useState(false);
  const view = navView(nav);
  const opened = useRef<string | null>(null);
  const stepped = useRef(false);

  useEffect(() => {
    if (opened.current === docId) return;
    opened.current = docId;
    api.openDocument(docId).catch(() => {});
  }, [docId]);

  const authors = useMemo(() => {
    const names = new Map((catchUp?.editors ?? []).map((e) => [e.id, e.name]));
    const only = catchUp?.editors.length === 1 ? catchUp.editors[0].name : null;
    return Object.fromEntries(ids.flatMap((id): [string, CatchUpAuthor][] => {
      const name = names.get(catchUp?.authors?.[id] ?? "") ?? only;
      return name ? [[id, { name, initials: initials(name), color: avatarColor(name) }]] : [];
    }));
  }, [catchUp, ids]);

  const done = !!nav.done;
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const marks = done && !fading ? { ids: [], activeId: null } : { ids: nav.ids, activeId: view.activeId, authors };
    editor.view.dispatch(editor.state.tr.setMeta(catchUpKey, marks).setMeta("addToHistory", false));
    if (!view.activeId || !stepped.current) return;
    const el = editor.view.dom.querySelector<HTMLElement>(`[data-id="${CSS.escape(view.activeId)}"]`);
    el?.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [editor, nav.ids, done, fading, view.activeId, authors]);

  const act = (a: CatchUpAction) => {
    stepped.current = true;
    const finishing = a.type === "dismiss" || (a.type === "next" && view.isLast);
    if (finishing && !done) {
      setFading(true);
      setTimeout(() => setFading(false), FADE_MS);
    }
    dispatch(a);
  };

  return {
    ...view,
    fading,
    since: catchUp?.since ?? null,
    editors: catchUp?.editors ?? [],
    removedCount: catchUp?.removedCount ?? 0,
    next: () => act({ type: "next" }),
    prev: () => act({ type: "prev" }),
    dismiss: () => act({ type: "dismiss" }),
  };
}
