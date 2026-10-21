import { beforeAll, describe, expect, it } from "vitest";
import * as docRoute from "@/app/api/documents/[id]/route";
import * as listRoute from "@/app/api/documents/route";
import { saveDocument } from "@/lib/server/documents";
import { upsertShare } from "@/lib/server/shares";
import { call, docWith, freshDb, type TestUsers } from "./helpers";

let u: TestUsers;
beforeAll(async () => ({ u } = await freshDb()));

async function sharedDoc() {
  const { json } = await call(listRoute.POST, { as: u.owner.id, method: "POST", body: { title: "Doc", content: docWith("one") } });
  await upsertShare(u.owner.id, json.id, { email: u.editor.email, role: "editor" });
  await upsertShare(u.owner.id, json.id, { email: u.viewer.email, role: "viewer" });
  return json.id as string;
}
const patch = (as: string, id: string, body: unknown) => call(docRoute.PATCH, { as, params: { id }, method: "PATCH", body });
const create = (body: unknown) => call(listRoute.POST, { as: u.owner.id, method: "POST", body });

describe("titles", () => {
  it.each([
    ["", "Untitled document"],
    ["   \t  ", "Untitled document"],
    ["Plan\nQ3\r\n\tdraft", "Plan Q3 draft"],
    ["a\u0000b\u0007c", "a b c"],
    ["🚀🔥✨", "🚀🔥✨"],
    ["  Spaced   out  ", "Spaced out"],
  ])("%j → %j (create and rename)", async (title, expected) => {
    const created = await create({ title });
    expect(created).toMatchObject({ status: 201, json: { title: expected } });
    expect((await patch(u.owner.id, created.json.id, { title })).json.title).toBe(expected);
  });

  it("over 200 characters → 400; exactly 200 is fine", async () => {
    expect((await create({ title: "t".repeat(201) })).status).toBe(400);
    expect((await create({ title: "t".repeat(200) })).json.title).toHaveLength(200);
  });

  it("non-string title → 400", async () => {
    expect((await create({ title: 42 })).status).toBe(400);
    expect((await create({ title: null })).status).toBe(400);
  });
});

describe("content", () => {
  it.each([
    ["wrong root type", { type: "paragraph" }, 400],
    ["content is not an array", { type: "doc", content: "hi" }, 400],
    ["unknown node type", { type: "doc", content: [{ type: "iframe" }] }, 422],
    ["unknown mark", { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link" }] }] }] }, 422],
    ["empty text node", { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }] }, 422],
    ["text at block level", { type: "doc", content: [{ type: "text", text: "loose" }] }, 422],
    ["heading level 6 (schema allows 1–3)", { type: "doc", content: [{ type: "heading", attrs: { level: 6 }, content: [{ type: "text", text: "h" }] }] }, 200],
  ])("%s → %i", async (_label, content, status) => {
    const id = await sharedDoc();
    const res = await patch(u.owner.id, id, { content, baseVersion: 1 });
    expect(res.status).toBe(status);
    if (status === 422) expect(res.json.error.code).toBe("INVALID_CONTENT");
  });

  it("deeply nested content → 422 INVALID_CONTENT, not a stack overflow", async () => {
    const id = await sharedDoc();
    let node: Record<string, unknown> = { type: "paragraph", content: [{ type: "text", text: "deep" }] };
    for (let i = 0; i < 1500; i++) node = { type: "blockquote", content: [node] };
    const res = await patch(u.owner.id, id, { content: { type: "doc", content: [node] }, baseVersion: 1 });
    expect(res).toMatchObject({ status: 422, json: { error: { code: "INVALID_CONTENT" } } });
    const n = 20_000; // deeper than JSON.stringify / ProseMirror recursion can survive
    const raw = `{"baseVersion":1,"content":{"type":"doc","content":[${'{"type":"blockquote","content":['.repeat(n)}{"type":"paragraph"}${"]}".repeat(n)}]}}`;
    expect((await call(docRoute.PATCH, { as: u.owner.id, params: { id }, method: "PATCH", raw })).status).toBe(422);
  });

  it("reasonable nesting (10-level list) is accepted", async () => {
    const id = await sharedDoc();
    let list: Record<string, unknown> = { type: "paragraph", content: [{ type: "text", text: "leaf" }] };
    for (let i = 0; i < 10; i++) list = { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: `l${i}` }] }, ...(list.type === "bulletList" ? [list] : [])] }] };
    expect((await patch(u.owner.id, id, { content: { type: "doc", content: [list] }, baseVersion: 1 })).status).toBe(200);
  });

  it("NUL characters are stripped instead of crashing Postgres", async () => {
    const id = await sharedDoc();
    expect((await patch(u.owner.id, id, { content: docWith("a\u0000b", "\u0000"), baseVersion: 1 })).status).toBe(200);
    const { json } = await call(docRoute.GET, { as: u.owner.id, params: { id } });
    expect(json.doc.content.content[0].content[0].text).toBe("ab");
  });

  it("content just under 1 MB saves; over 1 MB → 413", async () => {
    const id = await sharedDoc();
    expect((await patch(u.owner.id, id, { content: docWith("x".repeat(1000 * 1000)), baseVersion: 1 })).status).toBe(200);
    expect((await patch(u.owner.id, id, { content: docWith("x".repeat(1024 * 1024)), baseVersion: 2 })).json.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("baseVersion and force", () => {
  it.each([[undefined], [0], [-1], [1.5], ["1"], [null]])("baseVersion %j with content → 400", async (baseVersion) => {
    const id = await sharedDoc();
    expect((await patch(u.owner.id, id, { content: docWith("x"), baseVersion })).status).toBe(400);
  });

  it("baseVersion from the future → 409 with the current doc", async () => {
    const id = await sharedDoc();
    const res = await patch(u.owner.id, id, { content: docWith("x"), baseVersion: 99 });
    expect(res).toMatchObject({ status: 409, json: { error: { code: "STALE_VERSION", details: { current: { version: 1 } } } } });
  });

  it("force: editor may overwrite, viewer gets 403", async () => {
    const id = await sharedDoc();
    await patch(u.owner.id, id, { content: docWith("v2"), baseVersion: 1 });
    expect(await patch(u.editor.id, id, { content: docWith("mine"), baseVersion: 1, force: true })).toMatchObject({ status: 200, json: { version: 3 } });
    expect(await patch(u.viewer.id, id, { content: docWith("mine"), baseVersion: 1, force: true })).toMatchObject({ status: 403, json: { error: { code: "FORBIDDEN" } } });
  });

  it("empty body / title-less, content-less PATCH → 400", async () => {
    const id = await sharedDoc();
    expect((await patch(u.owner.id, id, {})).status).toBe(400);
    expect((await patch(u.owner.id, id, { force: true })).status).toBe(400);
  });
});

describe("deleted documents", () => {
  it("save, read, open and second delete after delete → 404", async () => {
    const id = await sharedDoc();
    expect((await call(docRoute.DELETE, { as: u.owner.id, method: "DELETE", params: { id } })).status).toBe(204);
    expect((await call(docRoute.DELETE, { as: u.owner.id, method: "DELETE", params: { id } })).status).toBe(404);
    expect((await patch(u.editor.id, id, { content: docWith("late"), baseVersion: 1 })).status).toBe(404);
    expect((await patch(u.editor.id, id, { title: "late" })).status).toBe(404);
    expect((await call(docRoute.GET, { as: u.viewer.id, params: { id } })).status).toBe(404);
  });

  it("dashboard drops a deleted doc for everyone", async () => {
    const id = await sharedDoc();
    await call(docRoute.DELETE, { as: u.owner.id, method: "DELETE", params: { id } });
    for (const as of [u.owner.id, u.editor.id]) {
      const { json } = await call(listRoute.GET, { as });
      expect([...json.owned, ...json.shared].some((d: { id: string }) => d.id === id)).toBe(false);
    }
  });
});

describe("concurrency", () => {
  it("two concurrent saves on the same baseVersion: exactly one wins, the other gets 409", async () => {
    const id = await sharedDoc();
    const results = await Promise.all([
      patch(u.owner.id, id, { content: docWith("owner"), baseVersion: 1 }),
      patch(u.editor.id, id, { content: docWith("editor"), baseVersion: 1 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = results.find((r) => r.status === 200)!;
    expect(winner.json.version).toBe(2);
    const doc = (await call(docRoute.GET, { as: u.owner.id, params: { id } })).json.doc;
    expect(doc.version).toBe(2);
  });

  it("five concurrent saves: one winner, four 409s, version bumps exactly once", async () => {
    const id = await sharedDoc();
    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => patch(u.editor.id, id, { content: docWith(`n${n}`), baseVersion: 1 })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
  });

  it("concurrent forced saves both land (force retries the compare-and-swap)", async () => {
    const id = await sharedDoc();
    const results = await Promise.all([
      patch(u.owner.id, id, { content: docWith("a"), baseVersion: 1, force: true }),
      patch(u.editor.id, id, { content: docWith("b"), baseVersion: 1, force: true }),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200]);
    expect(results.map((r) => r.json.version).sort()).toEqual([2, 3]);
  });

  it("a title-only save during an in-flight content save keeps both", async () => {
    const id = await sharedDoc();
    const [content, title] = await Promise.all([
      saveDocument(u.editor.id, id, { content: docWith("body v2"), baseVersion: 1 }),
      saveDocument(u.owner.id, id, { title: "Renamed mid-save" }),
    ]);
    expect(content.version).toBe(2);
    expect(title.version).toBeLessThanOrEqual(2);
    const doc = (await call(docRoute.GET, { as: u.owner.id, params: { id } })).json.doc;
    expect(doc).toMatchObject({ title: "Renamed mid-save", version: 2 });
    expect(doc.content.content[0].content[0].text).toBe("body v2");
  });

  it("a content save does not clobber a title it didn't send", async () => {
    const id = await sharedDoc();
    await patch(u.owner.id, id, { title: "Kept" });
    await patch(u.editor.id, id, { content: docWith("x"), baseVersion: 1 });
    expect((await call(docRoute.GET, { as: u.owner.id, params: { id } })).json.doc.title).toBe("Kept");
  });
});
