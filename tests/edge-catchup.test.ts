import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as docRoute from "@/app/api/documents/[id]/route";
import * as openRoute from "@/app/api/documents/[id]/open/route";
import * as listRoute from "@/app/api/documents/route";
import type { DB } from "@/lib/db/client";
import { documents } from "@/lib/db/schema";
import type { JSONNode } from "@/lib/editor/types";
import { createDocument } from "@/lib/server/documents";
import { upsertShare } from "@/lib/server/shares";
import { call, docWith, freshDb, type TestUsers } from "./helpers";

let db: DB, u: TestUsers;
beforeAll(async () => ({ db, u } = await freshDb()));

const open = (as: string, id: string) => call(openRoute.POST, { as, method: "POST", params: { id } });
const save = (as: string, id: string, content: unknown, baseVersion: number) =>
  call(docRoute.PATCH, { as, method: "PATCH", params: { id }, body: { content, baseVersion } });
const card = async (as: string, id: string) => {
  const { json } = await call(listRoute.GET, { as });
  return [...json.owned, ...json.shared].find((c: { id: string }) => c.id === id);
};
const para = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });

/** Owner + two editors, everyone has visited once. */
async function setup(...texts: string[]) {
  const doc = await createDocument(u.owner.id, { content: docWith(...texts) });
  await upsertShare(u.owner.id, doc.id, { email: u.editor.email, role: "editor" });
  await upsertShare(u.owner.id, doc.id, { email: u.stranger.email, role: "editor" });
  for (const who of [u.owner.id, u.editor.id, u.stranger.id]) await open(who, doc.id);
  await new Promise((r) => setTimeout(r, 5));
  return { id: doc.id, blocks: doc.content.content as JSONNode[] };
}

describe("catch-up edge cases", () => {
  it("first visit: no catch-up banner, but the dashboard says never opened", async () => {
    const doc = await createDocument(u.owner.id, { content: docWith("a") });
    await upsertShare(u.owner.id, doc.id, { email: u.viewer.email, role: "viewer" });
    expect(await card(u.viewer.id, doc.id)).toMatchObject({ newForYou: { changedBlocks: 0, neverOpened: true } });
    expect((await open(u.viewer.id, doc.id)).json.catchUp).toBeNull();
    expect((await card(u.viewer.id, doc.id)).newForYou.neverOpened).toBe(false);
  });

  it("my own edits never show up for me", async () => {
    const { id, blocks } = await setup("a", "b");
    await save(u.owner.id, id, { type: "doc", content: [{ ...blocks[0], content: [{ type: "text", text: "a2" }] }, blocks[1]] }, 1);
    expect((await open(u.owner.id, id)).json.catchUp).toMatchObject({ changedIds: [], removedCount: 0, editors: [] });
  });

  it("an editor's change is visible to the owner AND another editor, attributed per block", async () => {
    const { id, blocks } = await setup("a", "b");
    await save(u.editor.id, id, { type: "doc", content: [blocks[0], { ...blocks[1], content: [{ type: "text", text: "b2" }] }] }, 1);
    for (const who of [u.owner.id, u.stranger.id]) {
      const { json } = await call(docRoute.GET, { as: who, params: { id } });
      expect(json.catchUp.changedIds).toEqual([blocks[1].attrs!.id]);
      expect(json.catchUp.authors).toEqual({ [blocks[1].attrs!.id as string]: u.editor.id });
      expect(json.catchUp.editors).toEqual([{ id: u.editor.id, name: "Eddie Editor", count: 1 }]);
    }
  });

  it("deleted blocks count as removed, not changed", async () => {
    const { id, blocks } = await setup("a", "b", "c");
    await save(u.editor.id, id, { type: "doc", content: [blocks[0]] }, 1);
    expect((await open(u.owner.id, id)).json.catchUp).toMatchObject({ changedIds: [], removedCount: 2 });
  });

  it("reordering blocks (same ids, same content) is not a change", async () => {
    const { id, blocks } = await setup("a", "b", "c");
    await save(u.editor.id, id, { type: "doc", content: [blocks[2], blocks[0], blocks[1]] }, 1);
    expect((await open(u.owner.id, id)).json.catchUp).toMatchObject({ changedIds: [], removedCount: 0 });
  });

  it("blocks sent without ids get ids server-side and count as new", async () => {
    const { id, blocks } = await setup("a");
    const saved = await save(u.editor.id, id, { type: "doc", content: [blocks[0], para("no id")] }, 1);
    expect(saved.status).toBe(200);
    const { json } = await open(u.owner.id, id);
    const newBlock = json.doc.content.content[1];
    expect(typeof newBlock.attrs.id).toBe("string");
    expect(json.catchUp.changedIds).toEqual([newBlock.attrs.id]);
  });

  it("legacy doc stored without ids or block_meta: opens fine, first save starts tracking", async () => {
    const { id } = await setup("x");
    await db.update(documents).set({ content: { type: "doc", content: [para("old 1"), para("old 2")] }, blockMeta: {} }).where(eq(documents.id, id));
    const first = await open(u.owner.id, id);
    expect(first.status).toBe(200);
    expect(first.json.catchUp).toMatchObject({ changedIds: [], removedCount: 0 });
    await save(u.editor.id, id, { type: "doc", content: [para("old 1"), para("old 2 edited")] }, 1);
    const after = await call(docRoute.GET, { as: u.owner.id, params: { id } });
    expect(after.json.catchUp.changedIds).toHaveLength(2); // no prior hashes, so every block is new to the owner
  });

  it("dashboard count equals the doc view's changed + removed, and both clear after opening", async () => {
    const { id, blocks } = await setup("a", "b", "c", "d");
    await save(u.editor.id, id, {
      type: "doc",
      content: [{ ...blocks[0], content: [{ type: "text", text: "a2" }] }, blocks[2], para("new")],
    }, 1);
    const view = (await call(docRoute.GET, { as: u.owner.id, params: { id } })).json.catchUp;
    const dash = (await card(u.owner.id, id)).newForYou.changedBlocks;
    expect(view.changedIds.length + view.removedCount).toBe(dash);
    expect(dash).toBe(4); // a edited, new added, b and d removed
    await open(u.owner.id, id);
    expect((await card(u.owner.id, id)).newForYou.changedBlocks).toBe(0);
    expect((await call(docRoute.GET, { as: u.owner.id, params: { id } })).json.catchUp.changedIds).toEqual([]);
  });

  it("GET has no side effects; only POST /open advances last-seen", async () => {
    const { id, blocks } = await setup("a");
    await save(u.editor.id, id, { type: "doc", content: [{ ...blocks[0], content: [{ type: "text", text: "a2" }] }] }, 1);
    for (let i = 0; i < 2; i++) expect((await call(docRoute.GET, { as: u.owner.id, params: { id } })).json.catchUp.changedIds).toHaveLength(1);
  });
});
