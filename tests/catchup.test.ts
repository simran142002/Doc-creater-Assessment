import { beforeAll, describe, expect, it } from "vitest";
import * as docRoute from "@/app/api/documents/[id]/route";
import * as openRoute from "@/app/api/documents/[id]/open/route";
import * as noteSeenRoute from "@/app/api/documents/[id]/note/seen/route";
import * as listRoute from "@/app/api/documents/route";
import type { DocJSON } from "@/lib/editor/types";
import { catchUpFor, computeBlockMeta } from "@/lib/server/catchup";
import { createDocument } from "@/lib/server/documents";
import { upsertShare } from "@/lib/server/shares";
import { call, docWith, freshDb, type TestUsers } from "./helpers";

const block = (id: string, text: string) => ({ type: "paragraph", attrs: { id }, content: [{ type: "text", text }] });
const d = (...content: ReturnType<typeof block>[]): DocJSON => ({ type: "doc", content });

describe("computeBlockMeta / catchUpFor (pure)", () => {
  const t0 = new Date("2026-01-01T00:00:00Z");
  const t1 = new Date("2026-01-02T00:00:00Z");
  const base = computeBlockMeta({}, d(block("a", "A"), block("b", "B"), block("c", "C")), "alice", t0);

  it("stamps only changed or new blocks and tombstones removed ones", () => {
    const next = computeBlockMeta(base, d(block("a", "A"), block("b", "B2"), block("n", "N")), "bob", t1);
    expect(next.a).toEqual(base.a);
    expect(next.b).toMatchObject({ by: "bob", at: t1.toISOString() });
    expect(next.n).toMatchObject({ by: "bob" });
    expect(next.c).toMatchObject({ del: true, by: "bob" });
  });

  it("ignores block id churn in nested nodes", () => {
    const withIds = d({ ...block("a", "A"), content: [{ type: "text", text: "A" }] });
    expect(computeBlockMeta(base, withIds, "bob", t1).a).toEqual(base.a);
  });

  it("excludes my own edits and edits before last_seen; null on first visit", () => {
    const next = computeBlockMeta(base, d(block("a", "A"), block("b", "B2")), "bob", t1);
    expect(catchUpFor(next, t0, "alice")).toEqual({ since: t0.toISOString(), changedIds: ["b"], removedCount: 1, editors: [{ id: "bob", count: 2 }], authors: { b: "bob" } });
    expect(catchUpFor(next, t0, "bob")!.changedIds).toEqual([]);
    expect(catchUpFor(next, t1, "alice")!.changedIds).toEqual([]);
    expect(catchUpFor(next, null, "alice")).toBeNull();
  });
});

describe("catch-up through the API", () => {
  let u: TestUsers;
  beforeAll(async () => ({ u } = await freshDb()));

  it("A sees blocks B changed after A's last visit; B does not see their own", async () => {
    const doc = await createDocument(u.owner.id, { content: docWith("intro", "body", "outro") });
    await upsertShare(u.owner.id, doc.id, { email: u.editor.email, role: "editor", note: "Please review the body" });

    const bOpen = await call(openRoute.POST, { as: u.editor.id, method: "POST", params: { id: doc.id } });
    expect(bOpen.json.catchUp).toBeNull(); // first visit
    expect(bOpen.json.handoff).toMatchObject({ note: "Please review the body", unread: true, from: { name: "Olivia Owner" } });

    const blocks = bOpen.json.doc.content.content;
    const edited = { type: "doc", content: [blocks[0], { ...blocks[1], content: [{ type: "text", text: "body v2" }] }, blocks[2], { type: "paragraph", content: [{ type: "text", text: "new" }] }] };
    const saved = await call(docRoute.PATCH, { as: u.editor.id, method: "PATCH", params: { id: doc.id }, body: { content: edited, baseVersion: 1 } });
    expect(saved.status).toBe(200);

    const dash = await call(listRoute.GET, { as: u.owner.id });
    expect(dash.json.owned[0].newForYou).toMatchObject({ changedBlocks: 2, unreadNote: false });

    const aOpen = await call(openRoute.POST, { as: u.owner.id, method: "POST", params: { id: doc.id } });
    expect(aOpen.json.catchUp.changedIds).toHaveLength(2);
    expect(aOpen.json.catchUp.changedIds).toContain(blocks[1].attrs.id);
    expect(aOpen.json.catchUp.editors).toEqual([{ id: u.editor.id, name: "Eddie Editor", count: 2 }]);

    const bGet = await call(docRoute.GET, { as: u.editor.id, params: { id: doc.id } });
    expect(bGet.json.catchUp.changedIds).toEqual([]);
    expect(bGet.json.handoff.unread).toBe(true); // opening alone doesn't dismiss the note
    expect((await call(noteSeenRoute.POST, { as: u.editor.id, method: "POST", params: { id: doc.id } })).status).toBe(204);
    expect((await call(docRoute.GET, { as: u.editor.id, params: { id: doc.id } })).json.handoff.unread).toBe(false);

    const aAgain = await call(docRoute.GET, { as: u.owner.id, params: { id: doc.id } });
    expect(aAgain.json.catchUp.changedIds).toEqual([]);
    expect((await call(listRoute.GET, { as: u.owner.id })).json.owned[0].newForYou.changedBlocks).toBe(0);
  });
});
