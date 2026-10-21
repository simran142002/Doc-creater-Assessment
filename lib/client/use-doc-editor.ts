"use client";

import { useEditor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { extensions } from "@/lib/editor/extensions";
import { CatchUpHighlight } from "@/lib/editor/catchup-highlight";
import { api } from "./api";
import { AutosaveController, KEEPALIVE_MAX_BYTES } from "./autosave";
import type { Doc, DocJSON, Role } from "./types";

const TITLE_DEBOUNCE_MS = 600;
const DEFAULT_TITLE = "Untitled document";

export function useDocEditor({ doc, role, placeholder = "Start writing…" }: { doc: Doc; role: Role; placeholder?: string }) {
  const readOnly = role === "viewer";
  const [ctrl] = useState(
    () => new AutosaveController({
      version: doc.version,
      save: (body, opts) => api.patchDocument(doc.id, body, opts),
    }),
  );
  const save = useSyncExternalStore(ctrl.subscribe, ctrl.getState, ctrl.getState);

  const editor = useEditor({
    extensions: [...extensions, Placeholder.configure({ placeholder }), CatchUpHighlight],
    content: doc.content,
    editable: !readOnly,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: { role: "textbox", "aria-multiline": "true", "aria-label": "Document body", spellcheck: "true" } },
    // Skip non-user transactions (e.g. UniqueID filling ids on load), so opening a doc never saves it.
    onUpdate: ({ editor, transaction }) => {
      if (transaction.docChanged && transaction.getMeta("addToHistory") !== false) ctrl.update(editor.getJSON() as DocJSON);
    },
    onBlur: () => void ctrl.flush(),
  });

  useEffect(() => {
    if (editor && editor.isEditable === readOnly) editor.setEditable(!readOnly, false);
  }, [editor, readOnly]);

  useEffect(() => {
    const onHidden = () => document.visibilityState === "hidden" && void ctrl.flush();
    const onPageHide = () => {
      const size = editor ? JSON.stringify(editor.getJSON()).length : 0;
      void ctrl.flush({ keepalive: size <= KEEPALIVE_MAX_BYTES });
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void ctrl.flush();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!ctrl.hasUnsaved) return;
      void ctrl.flush({ keepalive: true });
      e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKey);
      void ctrl.flush();
    };
  }, [ctrl, editor]);

  const loadTheirs = useCallback(() => {
    const theirs = ctrl.loadTheirs();
    if (theirs && editor) editor.commands.setContent(theirs.content, { emitUpdate: false });
    return theirs;
  }, [ctrl, editor]);

  const title = useTitle(doc, readOnly);

  return {
    editor,
    readOnly,
    ...save,
    retry: () => ctrl.retry(),
    flush: () => ctrl.flush(),
    keepMine: () => ctrl.keepMine(),
    loadTheirs,
    title,
  };
}

/** Title is saved separately (no version check), debounced and flushed on blur. */
function useTitle(doc: Doc, readOnly: boolean) {
  const [value, setValue] = useState(doc.title);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saved = useRef(doc.title);
  const latest = useRef(doc.title);

  const commit = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = latest.current;
    if (readOnly || next === saved.current) return;
    try {
      const res = await api.patchDocument(doc.id, { title: next });
      saved.current = next;
      setError(null);
      if (!next.trim()) {
        latest.current = saved.current = res.title;
        setValue(res.title);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the title.");
    }
  }, [doc.id, readOnly]);

  const onChange = useCallback((v: string) => {
    latest.current = v;
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void commit(), TITLE_DEBOUNCE_MS);
  }, [commit]);

  useEffect(() => () => void commit(), [commit]);

  /** Escape: drop the unsaved rename. */
  const revert = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    latest.current = saved.current;
    setValue(saved.current || DEFAULT_TITLE);
  }, []);

  return { value, onChange, onBlur: commit, revert, error };
}
