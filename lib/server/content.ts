import { getSchema } from "@tiptap/core";
import { generateUniqueIds } from "@tiptap/extension-unique-id";
import { Node } from "@tiptap/pm/model";
import { extensions } from "@/lib/editor/extensions";
import type { DocJSON, JSONNode } from "@/lib/editor/types";
import { AppError } from "./errors";
import { LIMITS } from "./limits";

const schema = getSchema(extensions);

export const emptyDoc = (): DocJSON => ({ type: "doc", content: [{ type: "paragraph" }] });

/** Iterative so a hostile, deeply nested payload can't blow the stack before we reject it. */
function depthOf(json: unknown) {
  let max = 0;
  const stack: [unknown, number][] = [[json, 1]];
  while (stack.length) {
    const [v, d] = stack.pop()!;
    if (!v || typeof v !== "object") continue;
    if (d > LIMITS.contentDepth) return d;
    max = Math.max(max, d);
    for (const child of Object.values(v)) stack.push([child, d + 1]);
  }
  return max;
}

// Postgres text/jsonb cannot store U+0000.
const stripNul = (n: JSONNode): JSONNode => ({
  ...n,
  ...(n.text !== undefined && { text: n.text.replace(/\0/g, "") }),
  ...(n.content && { content: n.content.map(stripNul).filter((c) => c.text !== "") }),
});

/** Validates against the editor schema (normalising default attrs so hashes are stable), enforces size/depth caps and fills missing block ids. */
export function validateDoc(json: unknown): DocJSON {
  if (depthOf(json) > LIMITS.contentDepth) throw new AppError("INVALID_CONTENT", "Content is nested too deeply.");
  if (Buffer.byteLength(JSON.stringify(json ?? null)) > LIMITS.contentBytes)
    throw new AppError("PAYLOAD_TOO_LARGE", "Document content exceeds 1 MB.");
  let normalized: DocJSON;
  try {
    const node = Node.fromJSON(schema, json);
    node.check();
    normalized = stripNul(node.toJSON()) as DocJSON;
  } catch (e) {
    throw new AppError("INVALID_CONTENT", `Content does not match the editor schema: ${(e as Error).message}`);
  }
  return generateUniqueIds(normalized, extensions) as DocJSON;
}

/** Code-point-safe truncation (never splits an emoji). */
export const clip = (s: string, max: number) => [...s].slice(0, max).join("");

/** Single line: control characters become spaces, runs of whitespace collapse. Empty → default. */
export const cleanTitle = (s: string, fallback: string) =>
  clip(s.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, " ").replace(/\s+/g, " ").trim(), LIMITS.titleMax).trim() || fallback;

/** Notes keep line breaks but lose other control characters. */
export const cleanNote = (s: string) =>
  s.replace(/\r\n?/g, "\n").replace(/[^\P{Cc}\n\t]/gu, "").trim() || null;
