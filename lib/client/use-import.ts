"use client";

import { useCallback, useState } from "react";
import { api, ApiError } from "./api";
import { plural } from "./format";
import type { Doc, FidelityReport } from "./types";

export const IMPORT_ACCEPT = ".txt,.md,.markdown,.docx";
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;

export type ImportState =
  | { status: "idle" }
  | { status: "uploading"; fileName: string }
  | { status: "done"; doc: Doc; report: FidelityReport }
  | { status: "undone" }
  | { status: "error"; error: ApiError };

/** Client-side precheck so the obvious mistakes never hit the network. */
export function precheckFile(file: File): ApiError | null {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (!["txt", "md", "markdown", "docx"].includes(ext))
    return new ApiError("UNSUPPORTED_TYPE", "Only .txt, .md and .docx files can be imported.", 415);
  if (file.size === 0) return new ApiError("EMPTY_FILE", "The file is empty.", 422);
  if (file.size > IMPORT_MAX_BYTES) return new ApiError("PAYLOAD_TOO_LARGE", "Files must be 2 MB or smaller.", 413);
  return null;
}

const KEPT: Record<string, string> = { headings: "heading", listItems: "list item", bold: "bold run", italic: "italic run", underline: "underline" };
const FLATTENED: Record<string, string> = { tables: "table", headingLevels4to6: "small heading", links: "link" };
const DROPPED: Record<string, string> = { images: "image" };

const phrase = (counts: Record<string, number>, labels: Record<string, string>) =>
  Object.entries(counts).filter(([k, n]) => labels[k] && n).map(([k, n]) => plural(n, labels[k])).join(", ") || null;

/** Prototype wording: "kept 2 headings, 1 bold run; flattened 1 table to plain text; dropped 1 image". */
export function fidelityParts(r: FidelityReport, words: number) {
  return {
    kept: phrase(r.kept, KEPT) ?? `${plural(words, "word")} of text`,
    flattened: phrase(r.dropped, FLATTENED),
    dropped: phrase(r.dropped, DROPPED),
  };
}

const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

/** Plain-language import errors, naming the file. */
export function importErrorMessage(e: ApiError, file: File) {
  const n = `“${file.name}”`;
  switch (e.code) {
    case "UNSUPPORTED_TYPE": return `${n} isn't a supported file. Use .txt, .md or .docx.`;
    case "PAYLOAD_TOO_LARGE": return file.size > 2 * 1024 * 1024 ? `${n} is ${fmtSize(file.size)} — the limit is 2 MB.` : `${n}: ${e.message}`;
    case "EMPTY_FILE": return file.size === 0 ? `${n} is empty. There's nothing to import.` : `${n} has no readable text.`;
    case "CORRUPT_FILE": return `We couldn't read ${n}. It may be corrupted, password-protected, or not really a .docx.`;
    case "NETWORK": return "You're offline. Importing needs a connection — try again when you're back.";
    default: return e.message;
  }
}

export function useImport() {
  const [state, setState] = useState<ImportState>({ status: "idle" });

  const undoDoc = useCallback(async (id: string) => {
    await api.deleteDocument(id);
    setState({ status: "undone" });
  }, []);

  const upload = useCallback(async (file: File) => {
    const bad = precheckFile(file);
    if (bad) {
      setState({ status: "error", error: bad });
      throw bad;
    }
    setState({ status: "uploading", fileName: file.name });
    try {
      const res = await api.importFile(file);
      setState({ status: "done", ...res });
      return { ...res, undo: () => undoDoc(res.doc.id) };
    } catch (e) {
      const error = e instanceof ApiError ? e : new ApiError("INTERNAL", "Import failed.", 500);
      setState({ status: "error", error });
      throw error;
    }
  }, [undoDoc]);

  const undo = useCallback(() => (state.status === "done" ? undoDoc(state.doc.id) : Promise.resolve()), [state, undoDoc]);
  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, upload, undo, reset, busy: state.status === "uploading" };
}
