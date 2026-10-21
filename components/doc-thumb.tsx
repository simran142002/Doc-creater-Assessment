import { createElement, type ReactNode } from "react";
import type { JSONNode } from "@/lib/client/types";

const MARKS: Record<string, string> = { bold: "strong", italic: "em", underline: "u", strike: "s", code: "code" };
const BLOCKS: Record<string, string> = { paragraph: "p", bulletList: "ul", orderedList: "ol", listItem: "li", blockquote: "blockquote", codeBlock: "pre", horizontalRule: "hr", hardBreak: "br" };

function render(n: JSONNode, key: number): ReactNode {
  if (n.type === "text") return (n.marks ?? []).reduceRight<ReactNode>((acc, m) => (MARKS[m.type] ? createElement(MARKS[m.type], { key }, acc) : acc), n.text);
  const tag = n.type === "heading" ? `h${Number(n.attrs?.level) || 1}` : BLOCKS[n.type];
  if (!tag) return null;
  const kids = n.content?.map(render);
  return createElement(tag, { key }, ...(kids && tag !== "hr" && tag !== "br" ? [kids] : []));
}

/** Read-only miniature of a doc's first blocks for dashboard cards. */
export function DocThumb({ blocks }: { blocks: JSONNode[] }) {
  return <div className="prose">{blocks.map(render)}</div>;
}
