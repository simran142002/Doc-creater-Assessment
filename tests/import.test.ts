import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import * as importRoute from "@/app/api/import/route";
import type { JSONNode } from "@/lib/editor/types";
import { parseUpload } from "@/lib/server/import";
import { call, freshDb, type TestUsers } from "./helpers";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function collect(n: JSONNode, out: { nodes: string[]; marks: Set<string> } = { nodes: [], marks: new Set() }) {
  out.nodes.push(n.type === "heading" ? `h${n.attrs!.level}` : n.type);
  n.marks?.forEach((m) => out.marks.add(m.type));
  n.content?.forEach((c) => collect(c, out));
  return out;
}

describe("parseUpload", () => {
  it("markdown → headings, lists, marks; drops script, table structure and links", async () => {
    const r = await parseUpload({ name: "release.md", type: "text/markdown", bytes: fixture("sample.md") });
    const top = r.content.content!.map((n) => (n.type === "heading" ? `h${n.attrs!.level}` : n.type));
    expect(r.title).toBe("release");
    expect(top.slice(0, 5)).toEqual(["h1", "paragraph", "h2", "bulletList", "orderedList"]);
    expect([...collect(r.content).marks].sort()).toEqual(["bold", "italic"]);
    expect(JSON.stringify(r.content)).not.toContain("alert");
    expect(r.content.content!.every((b) => typeof b.attrs?.id === "string")).toBe(true);
    expect(r.report).toMatchObject({
      source: "md",
      kept: { headings: 2, bulletLists: 1, numberedLists: 1, listItems: 5, bold: 1, italic: 1 },
      dropped: { tables: 1, links: 1, headingLevels4to6: 1 },
    });
  });

  it("docx → headings, bullets, numbered list, bold/italic/underline; table reported as dropped", async () => {
    const r = await parseUpload({ name: "Quarterly plan.docx", type: DOCX, bytes: fixture("sample.docx") });
    const { nodes, marks } = collect(r.content);
    expect(r.title).toBe("Quarterly plan");
    expect(nodes).toEqual(expect.arrayContaining(["h1", "h2", "bulletList", "orderedList"]));
    expect([...marks].sort()).toEqual(["bold", "italic", "underline"]);
    expect(r.report).toMatchObject({
      source: "docx",
      kept: { headings: 2, bulletLists: 1, numberedLists: 1, listItems: 4, bold: 1, italic: 1, underline: 1 },
      dropped: { tables: 1 },
    });
  });

  it("txt → one paragraph per line", async () => {
    const r = await parseUpload({ name: "a.txt", type: "text/plain", bytes: Buffer.from("one\n\ntwo <b>\n") });
    expect(r.content.content!.map((b) => b.content![0].text)).toEqual(["one", "two <b>"]);
    expect(r.report.kept).toEqual({ paragraphs: 2 });
  });

  it.each([
    ["bad.exe", "application/octet-stream", Buffer.from("MZ"), "UNSUPPORTED_TYPE"],
    ["x.md", "image/png", Buffer.from("# hi"), "UNSUPPORTED_TYPE"],
    ["empty.txt", "text/plain", Buffer.alloc(0), "EMPTY_FILE"],
    ["blank.md", "text/markdown", Buffer.from("   \n\n"), "EMPTY_FILE"],
    ["big.txt", "text/plain", Buffer.alloc(2 * 1024 * 1024 + 1, 97), "PAYLOAD_TOO_LARGE"],
    ["fake.docx", DOCX, Buffer.from("not a zip"), "CORRUPT_FILE"],
    ["bin.txt", "text/plain", Buffer.from([0xff, 0xfe, 0xfd]), "CORRUPT_FILE"],
  ])("%s → %s", async (name, type, bytes, code) => {
    await expect(parseUpload({ name, type, bytes })).rejects.toMatchObject({ code });
  });
});

describe("POST /api/import", () => {
  let u: TestUsers;
  beforeAll(async () => ({ u } = await freshDb()));

  const upload = (as: string | undefined, name: string, bytes: Buffer, type = "") => {
    const form = new FormData();
    form.append("file", new File([new Uint8Array(bytes)], name, { type }));
    return call(importRoute.POST, { as, method: "POST", form });
  };

  it("creates an owned doc and returns the report", async () => {
    const res = await upload(u.owner.id, "release.md", fixture("sample.md"), "text/markdown");
    expect(res.status).toBe(201);
    expect(res.json.doc).toMatchObject({ title: "release", source: "import", version: 1, owner: { id: u.owner.id } });
    expect(res.json.report.kept.headings).toBe(2);
  });

  it("maps errors to status codes", async () => {
    expect((await upload(u.owner.id, "x.pdf", Buffer.from("%PDF"))).status).toBe(415);
    expect((await upload(u.owner.id, "e.txt", Buffer.alloc(0))).status).toBe(422);
    expect((await upload(u.owner.id, "big.md", Buffer.alloc(2 * 1024 * 1024 + 10, 97))).status).toBe(413);
    expect((await upload(undefined, "a.md", Buffer.from("# a"))).status).toBe(401);
  });
});
