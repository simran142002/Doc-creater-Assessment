import type { Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import UniqueID from "@tiptap/extension-unique-id";

/** Top-level block types that carry a stable `id` attr (catch-up granularity). */
export const BLOCK_TYPES = ["paragraph", "heading", "bulletList", "orderedList", "blockquote", "codeBlock", "horizontalRule"];

/** The document schema, shared by the client editor, server validation and import. Underline ships in StarterKit v3. */
export const extensions: Extensions = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: false }),
  UniqueID.configure({ types: BLOCK_TYPES }),
];
