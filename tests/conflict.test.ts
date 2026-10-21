import { beforeAll, describe, expect, it } from "vitest";
import * as docRoute from "@/app/api/documents/[id]/route";
import * as listRoute from "@/app/api/documents/route";
import { upsertShare } from "@/lib/server/shares";
import { call, docWith, freshDb, type TestUsers } from "./helpers";

let u: TestUsers;
beforeAll(async () => ({ u } = await freshDb()));

async function sharedDoc() {
  const created = await call(listRoute.POST, { as: u.owner.id, method: "POST", body: { title: "Plan", content: docWith("one") } });
  expect(created.status).toBe(201);
  await upsertShare(u.owner.id, created.json.id, { email: u.editor.email, role: "editor" });
  return created.json as { id: string; version: number };
}

const patch = (as: string, id: string, body: unknown) => call(docRoute.PATCH, { as, params: { id }, method: "PATCH", body });

describe("optimistic concurrency", () => {
  it("second save on a stale baseVersion gets 409 with the current doc and who saved it", async () => {
    const doc = await sharedDoc();
    expect(doc.version).toBe(1);
    const first = await patch(u.editor.id, doc.id, { content: docWith("editor"), baseVersion: 1 });
    expect(first).toMatchObject({ status: 200, json: { version: 2 } });

    const stale = await patch(u.owner.id, doc.id, { content: docWith("owner"), baseVersion: 1 });
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe("STALE_VERSION");
    expect(stale.json.error.details.current).toMatchObject({ version: 2, updatedBy: { id: u.editor.id, name: "Eddie Editor" } });
    expect(stale.json.error.details.current.doc.content.content[0].content[0].text).toBe("editor");

    const forced = await patch(u.owner.id, doc.id, { content: docWith("owner"), baseVersion: 1, force: true });
    expect(forced).toMatchObject({ status: 200, json: { version: 3 } });
  });

  it("title-only saves are last-write-wins and do not bump the version", async () => {
    const doc = await sharedDoc();
    const res = await patch(u.editor.id, doc.id, { title: "  Renamed  " });
    expect(res.json).toMatchObject({ version: 1, title: "Renamed" });
  });

  it("validates payloads", async () => {
    const doc = await sharedDoc();
    expect((await patch(u.owner.id, doc.id, { content: docWith("x") })).status).toBe(400);
    expect((await patch(u.owner.id, doc.id, { title: "t".repeat(201) })).status).toBe(400);
    const bad = await patch(u.owner.id, doc.id, { content: { type: "doc", content: [{ type: "table" }] }, baseVersion: 1 });
    expect(bad).toMatchObject({ status: 422, json: { error: { code: "INVALID_CONTENT" } } });
    const huge = await patch(u.owner.id, doc.id, { content: docWith("x".repeat(1024 * 1024)), baseVersion: 1 });
    expect(huge.status).toBe(413);
  });
});
