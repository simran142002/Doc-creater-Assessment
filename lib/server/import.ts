import { generateJSON } from "@tiptap/html";
import { Window } from "happy-dom";
import mammoth from "mammoth";
import { marked } from "marked";
import { extensions } from "@/lib/editor/extensions";
import type { DocJSON, JSONNode } from "@/lib/editor/types";
import { cleanTitle, validateDoc } from "./content";
import { AppError } from "./errors";
import { LIMITS } from "./limits";

type Kind = "txt" | "md" | "docx";

const EXT: Record<string, Kind> = { txt: "txt", md: "md", markdown: "md", docx: "docx" };
const MIME: Record<Kind, string[]> = {
  txt: ["text/plain"],
  md: ["text/markdown", "text/x-markdown", "text/plain"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"],
};
const GENERIC_MIME = ["", "application/octet-stream"];

export type FidelityReport = {
  source: Kind;
  kept: Record<string, number>;
  dropped: Record<string, number>;
  warnings: string[];
};

export type ParsedUpload = { title: string; content: DocJSON; report: FidelityReport };

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function detectKind(name: string, mime: string): Kind {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const kind = EXT[ext];
  if (!kind) throw new AppError("UNSUPPORTED_TYPE", "Only .txt, .md and .docx files can be imported.");
  const type = mime.split(";")[0].trim().toLowerCase();
  if (!GENERIC_MIME.includes(type) && !MIME[kind].includes(type))
    throw new AppError("UNSUPPORTED_TYPE", `File type ${type} does not match .${ext}.`);
  return kind;
}

/** UTF-8 (BOM optional) or BOM-marked UTF-16. NUL bytes mean a binary file renamed to .txt/.md. */
function decodeText(buf: Buffer) {
  const enc = buf[0] === 0xff && buf[1] === 0xfe ? "utf-16le" : buf[0] === 0xfe && buf[1] === 0xff ? "utf-16be" : "utf-8";
  let text: string;
  try {
    text = new TextDecoder(enc, { fatal: true }).decode(buf);
  } catch {
    throw new AppError("CORRUPT_FILE", "File is not UTF-8 text. Re-save it as UTF-8 and try again.");
  }
  if (text.includes("\0")) throw new AppError("CORRUPT_FILE", "This looks like a binary file, not text.");
  return text;
}

/** Tables aren't in the schema: each row becomes its own paragraph with cells joined by " · ". */
function flattenTables(html: string) {
  if (!/<table[\s>]/i.test(html)) return html;
  const win = new Window({ settings: { disableJavaScriptEvaluation: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  try {
    const root = win.document.createElement("div");
    root.innerHTML = html;
    for (const table of [...root.querySelectorAll("table")].filter((t) => !t.parentElement?.closest("table"))) {
      const rows = [...table.querySelectorAll("tr")].filter((tr) => tr.closest("table") === table).map((tr) => {
        const p = win.document.createElement("p");
        p.textContent = [...tr.children].map((c) => c.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean).join(" · ");
        return p;
      }).filter((p) => p.textContent);
      table.replaceWith(...rows);
    }
    return root.innerHTML;
  } finally {
    void win.happyDOM.close();
  }
}

async function toHtml(kind: Kind, buf: Buffer): Promise<{ html: string; warnings: string[] }> {
  if (kind === "docx") {
    if (buf.subarray(0, 4).toString("binary") !== "PK\x03\x04")
      throw new AppError("CORRUPT_FILE", "This .docx file is damaged or not a Word document.");
    try {
      const res = await mammoth.convertToHtml(
        { buffer: buf },
        { styleMap: ["u => u"], convertImage: mammoth.images.imgElement(async () => ({ src: "" })) },
      );
      return { html: res.value, warnings: res.messages.filter((m) => m.type === "warning").map((m) => m.message) };
    } catch {
      throw new AppError("CORRUPT_FILE", "This .docx file could not be read.");
    }
  }
  const text = decodeText(buf);
  if (kind === "md") return { html: await marked.parse(text, { gfm: true }), warnings: [] };
  const html = text.split(/\r\n?|\n/).filter((l) => l.trim()).map((l) => `<p>${escapeHtml(l)}</p>`).join("");
  return { html, warnings: [] };
}

const countTags = (html: string, tags: string[]) =>
  tags.reduce((n, t) => n + (html.match(new RegExp(`<${t}[\\s>/]`, "gi"))?.length ?? 0), 0);

function countNodes(doc: JSONNode) {
  const counts: Record<string, number> = {};
  const walk = (n: JSONNode) => {
    counts[n.type] = (counts[n.type] ?? 0) + 1;
    n.content?.forEach(walk);
  };
  walk(doc);
  return counts;
}

function buildReport(kind: Kind, html: string, doc: DocJSON, warnings: string[]): FidelityReport {
  const nodes = countNodes(doc);
  const prune = (r: Record<string, number>) => Object.fromEntries(Object.entries(r).filter(([, v]) => v > 0));
  const kept = prune({
    headings: nodes.heading ?? 0,
    paragraphs: nodes.paragraph ?? 0,
    bulletLists: nodes.bulletList ?? 0,
    numberedLists: nodes.orderedList ?? 0,
    listItems: nodes.listItem ?? 0,
    quotes: nodes.blockquote ?? 0,
    codeBlocks: nodes.codeBlock ?? 0,
    dividers: nodes.horizontalRule ?? 0,
    bold: countTags(html, ["strong", "b"]),
    italic: countTags(html, ["em", "i"]),
    underline: countTags(html, ["u"]),
    strikethrough: countTags(html, ["s", "del", "strike"]),
  });
  const dropped = prune({
    tables: countTags(html, ["table"]),
    images: countTags(html, ["img"]),
    links: countTags(html, ["a"]),
    headingLevels4to6: countTags(html, ["h4", "h5", "h6"]),
  });
  const notes = [...warnings];
  if (dropped.tables) notes.push(`${dropped.tables} table${dropped.tables > 1 ? "s" : ""} flattened: each row is now a paragraph.`);
  if (dropped.images) notes.push("Images are not supported and were removed.");
  if (dropped.links) notes.push("Links were kept as plain text.");
  if (dropped.headingLevels4to6) notes.push("Headings below H3 became normal text.");
  return { source: kind, kept, dropped, warnings: notes };
}

const hasText = (n: JSONNode): boolean => !!n.text?.trim() || !!n.content?.some(hasText);

export async function parseUpload(file: { name: string; type: string; bytes: Buffer }): Promise<ParsedUpload> {
  const kind = detectKind(file.name, file.type);
  if (file.bytes.length === 0) throw new AppError("EMPTY_FILE", "The file is empty.");
  if (file.bytes.length > LIMITS.uploadBytes) throw new AppError("PAYLOAD_TOO_LARGE", "Files must be 2 MB or smaller.");
  const { html, warnings } = await toHtml(kind, file.bytes);
  // A block costs ≥ ~100 bytes of JSON, so past this it can't fit in 1 MB anyway; bail before the DOM parse eats memory.
  if (countTags(html, ["p", "h[1-6]", "li", "tr", "pre", "hr", "blockquote"]) > LIMITS.importBlocks)
    throw new AppError("PAYLOAD_TOO_LARGE", `This file has too many lines or paragraphs (max ${LIMITS.importBlocks.toLocaleString("en")}).`);
  const json = generateJSON(flattenTables(html), extensions) as DocJSON;
  if (!hasText(json)) throw new AppError("EMPTY_FILE", "No readable content in this file.");
  const content = validateDoc(json);
  const base = file.name.split(/[\\/]/).pop()!.replace(/\.[^.]+$/, "");
  const title = cleanTitle(base, "Imported document");
  return { title, content, report: buildReport(kind, html, content, warnings) };
}
