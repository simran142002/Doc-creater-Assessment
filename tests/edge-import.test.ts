import { Document, ImageRun, Packer, Paragraph, Table, TableCell, TableRow } from "docx";
import { beforeAll, describe, expect, it } from "vitest";
import * as importRoute from "@/app/api/import/route";
import type { DocJSON, JSONNode } from "@/lib/editor/types";
import { parseUpload } from "@/lib/server/import";
import { call, freshDb, type TestUsers } from "./helpers";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const parse = (name: string, bytes: Buffer | string, type = "") =>
  parseUpload({ name, type, bytes: typeof bytes === "string" ? Buffer.from(bytes) : bytes });
const texts = (d: DocJSON) => d.content!.map(function t(n: JSONNode): string { return n.text ?? (n.content ?? []).map(t).join(""); });

const cell = (t: string) => new TableCell({ children: [new Paragraph(t)] });
const docxWith = (children: (Paragraph | Table)[]) => Packer.toBuffer(new Document({ sections: [{ children }] }));

describe("import: types and sizes", () => {
  it.each([
    ["notes.pdf", "application/pdf", "%PDF-1.7", "UNSUPPORTED_TYPE"],
    ["README", "text/plain", "hello", "UNSUPPORTED_TYPE"],
    ["notes.txt.exe", "", "MZ", "UNSUPPORTED_TYPE"],
    ["photo.md", "image/png", "# hi", "UNSUPPORTED_TYPE"],
    ["real.docx", DOCX, "this is just text", "CORRUPT_FILE"],
    ["zipish.docx", DOCX, Buffer.concat([Buffer.from("PK\x03\x04"), Buffer.alloc(200, 7)]), "CORRUPT_FILE"],
    ["nul.txt", "text/plain", "abc\u0000def", "CORRUPT_FILE"],
    ["latin1.txt", "text/plain", Buffer.from([0x63, 0x61, 0x66, 0xe9]), "CORRUPT_FILE"],
  ])("%s (%s) → %s", async (name, type, bytes, code) => {
    await expect(parse(name, bytes as Buffer | string, type)).rejects.toMatchObject({ code });
  });

  it("extension wins over a generic MIME: .md as application/octet-stream and .MD uppercase work", async () => {
    expect((await parse("a.md", "# Hi", "application/octet-stream")).content.content![0].type).toBe("heading");
    expect((await parse("B.MD", "# Hi", "text/markdown; charset=utf-8")).title).toBe("B");
    expect((await parse("c.markdown", "text", "text/x-markdown")).title).toBe("c");
  });

  it("huge line counts are rejected fast with 413 instead of exhausting memory", async () => {
    const t = Date.now();
    await expect(parse("lines.txt", "a\n".repeat(1024 * 1024 - 1))).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    expect(Date.now() - t).toBeLessThan(5000);
  });

  it("a long-but-reasonable file (5,000 lines) imports", async () => {
    const r = await parse("long.txt", Array.from({ length: 5000 }, (_, i) => `line ${i}`).join("\n"));
    expect(r.content.content).toHaveLength(5000);
  });
});

describe("import: text encodings and line endings", () => {
  it("UTF-8 BOM is stripped", async () => {
    expect(texts((await parse("bom.txt", Buffer.from("\uFEFFhello\nworld"))).content)).toEqual(["hello", "world"]);
  });

  it("UTF-16 LE and BE with BOM decode", async () => {
    const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("héllo\nwörld", "utf16le")]);
    expect(texts((await parse("le.txt", le)).content)).toEqual(["héllo", "wörld"]);
    const be = Buffer.from(le.subarray(2)).swap16();
    expect(texts((await parse("be.txt", Buffer.concat([Buffer.from([0xfe, 0xff]), be]))).content)).toEqual(["héllo", "wörld"]);
  });

  it("CRLF and lone CR line endings both split into paragraphs", async () => {
    expect(texts((await parse("crlf.txt", "a\r\nb\r\n\r\nc")).content)).toEqual(["a", "b", "c"]);
    expect(texts((await parse("cr.txt", "a\rb\rc")).content)).toEqual(["a", "b", "c"]);
  });

  it(".txt content is literal text: markup is escaped, not parsed", async () => {
    expect(texts((await parse("x.txt", "<script>alert(1)</script>\n# not a heading")).content)).toEqual(["<script>alert(1)</script>", "# not a heading"]);
  });
});

describe("import: sanitising markdown", () => {
  it("no script, event handler, iframe, style or javascript: URL survives", async () => {
    const md = [
      "# Title",
      "<script>alert('xss')</script>",
      "<img src=x onerror=\"alert('img')\">",
      "<iframe src=\"javascript:alert('frame')\"></iframe>",
      "<style>body{display:none}</style>",
      "[click](javascript:alert('link')) and <a href=\"javascript:alert('a')\">raw</a>",
      "<div onclick=\"alert('div')\">div text</div>",
      "![pic](javascript:alert('pic'))",
      "<svg><script>alert('svg')</script></svg>",
    ].join("\n\n");
    const r = await parse("evil.md", md, "text/markdown");
    const json = JSON.stringify(r.content);
    expect(json).not.toMatch(/alert|javascript:|onerror|onclick|<script|iframe|display:none/i);
    expect(json).toContain("div text");
    expect(json).toContain("click");
    expect(r.content.content![0]).toMatchObject({ type: "heading" });
  });
});

describe("import: docx images and tables", () => {
  it("images are dropped and reported; text around them is kept", async () => {
    const buf = await docxWith([
      new Paragraph("Before image"),
      new Paragraph({ children: [new ImageRun({ type: "png", data: PNG, transformation: { width: 10, height: 10 } })] }),
      new Paragraph("After image"),
    ]);
    const r = await parse("pics.docx", buf, DOCX);
    expect(texts(r.content).filter(Boolean)).toEqual(["Before image", "After image"]);
    expect(JSON.stringify(r.content)).not.toMatch(/"type":"image"|data:image|"src"/);
    expect(r.report.dropped.images).toBe(1);
    expect(r.report.warnings).toContain("Images are not supported and were removed.");
  });

  it("each table row becomes its own paragraph, cells joined by ' · ', reported as flattened", async () => {
    const buf = await docxWith([
      new Paragraph("Intro"),
      new Table({ rows: [new TableRow({ children: [cell("Name"), cell("Owner")] }), new TableRow({ children: [cell("Autosave"), cell("Priya")] })] }),
    ]);
    const r = await parse("table.docx", buf, DOCX);
    expect(texts(r.content)).toEqual(["Intro", "Name · Owner", "Autosave · Priya"]);
    expect(r.report.dropped.tables).toBe(1);
    expect(r.report.warnings).toContain("1 table flattened: each row is now a paragraph.");
  });

  it("markdown tables flatten the same way", async () => {
    const r = await parse("t.md", "| Col A | Col B |\n| --- | --- |\n| a | b |\n| <b>c</b> | |\n", "text/markdown");
    expect(texts(r.content)).toEqual(["Col A · Col B", "a · b", "c"]);
    expect(r.report.warnings).toContain("1 table flattened: each row is now a paragraph.");
  });
});

describe("import: filenames → titles", () => {
  it.each([
    ["../../etc/passwd.txt", "passwd"],
    ["C:\\Users\\me\\Desktop\\plan.md", "plan"],
    ["über façade 📄.md", "über façade 📄"],
    ["tab\tand\nnewline.txt", "tab and newline"],
    [".md", "Imported document"],
    ["   .txt", "Imported document"],
  ])("%j → %j", async (name, title) => {
    expect((await parse(name, "hello")).title).toBe(title);
  });

  it("very long names are cut to 200 characters without splitting an emoji", async () => {
    const r = await parse(`${"😀".repeat(250)}.txt`, "hello");
    expect([...r.title]).toHaveLength(200);
    expect(r.title).toBe("😀".repeat(200));
  });
});

describe("POST /api/import edge cases", () => {
  let u: TestUsers;
  beforeAll(async () => ({ u } = await freshDb()));
  const post = (form: FormData | undefined, extra: { raw?: string; headers?: Record<string, string> } = {}) =>
    call(importRoute.POST, { as: u.owner.id, method: "POST", form, ...extra });
  const file = (name: string, text: string, type = "") => new File([text], name, { type });

  it("no file field / file as a plain string / JSON body → 400", async () => {
    const empty = new FormData();
    empty.append("other", "x");
    expect(await post(empty)).toMatchObject({ status: 400, json: { error: { code: "VALIDATION" } } });
    const str = new FormData();
    str.append("file", "not a file");
    expect((await post(str)).status).toBe(400);
    expect((await post(undefined, { raw: '{"file":"x"}', headers: { "content-type": "application/json" } })).status).toBe(400);
  });

  it("multiple files in one request → 400 (one at a time)", async () => {
    const form = new FormData();
    form.append("file", file("a.md", "# a"));
    form.append("file", file("b.md", "# b"));
    expect(await post(form)).toMatchObject({ status: 400, json: { error: { code: "VALIDATION", message: "Import one file at a time." } } });
  });

  it("empty file → 422, oversize Content-Length → 413 before reading", async () => {
    const form = new FormData();
    form.append("file", file("e.txt", ""));
    expect((await post(form)).json.error.code).toBe("EMPTY_FILE");
    const ok = new FormData();
    ok.append("file", file("a.txt", "hi"));
    expect((await post(ok, { headers: { "content-length": String(10 * 1024 * 1024) } })).status).toBe(413);
  });

  it("imported doc gets a sanitised title and block ids", async () => {
    const form = new FormData();
    form.append("file", file("../secret/notes.md", "# A\n\ntext"));
    const res = await post(form);
    expect(res.status).toBe(201);
    expect(res.json.doc.title).toBe("notes");
    expect(res.json.doc.content.content.every((b: JSONNode) => typeof b.attrs?.id === "string")).toBe(true);
  });
});
