import { beforeAll, describe, expect, it } from "vitest";
import * as docRoute from "@/app/api/documents/[id]/route";
import * as sharesRoute from "@/app/api/documents/[id]/shares/route";
import * as listRoute from "@/app/api/documents/route";
import { can, getAccess, type Action } from "@/lib/server/access";
import { createDocument } from "@/lib/server/documents";
import { upsertShare } from "@/lib/server/shares";
import { call, docWith, freshDb, type TestUsers } from "./helpers";

let u: TestUsers;

describe("can()", () => {
  const expected: Record<string, Action[]> = {
    owner: ["read", "write", "share", "delete"],
    editor: ["read", "write"],
    viewer: ["read"],
  };
  for (const role of ["owner", "editor", "viewer", null] as const)
    for (const action of ["read", "write", "share", "delete"] as const)
      it(`${role ?? "stranger"} ${action}`, () => expect(can(role, action)).toBe(!!role && expected[role].includes(action)));
});

describe("route access matrix", () => {
  const fresh = async () => {
    const doc = await createDocument(u.owner.id, { title: "Matrix" });
    await upsertShare(u.owner.id, doc.id, { email: u.editor.email, role: "editor" });
    await upsertShare(u.owner.id, doc.id, { email: u.viewer.email, role: "viewer" });
    return doc;
  };

  beforeAll(async () => ({ u } = await freshDb()));

  it("getAccess resolves each role from real rows", async () => {
    const doc = await fresh();
    expect(await getAccess(u.owner.id, doc.id)).toBe("owner");
    expect(await getAccess(u.editor.id, doc.id)).toBe("editor");
    expect(await getAccess(u.viewer.id, doc.id)).toBe("viewer");
    expect(await getAccess(u.stranger.id, doc.id)).toBeNull();
    expect(await getAccess(u.owner.id, "not-a-uuid")).toBeNull();
  });

  const table = {
    owner: { read: 200, write: 200, members: 200, share: 201, delete: 204 },
    editor: { read: 200, write: 200, members: 200, share: 403, delete: 403 },
    viewer: { read: 200, write: 403, members: 200, share: 403, delete: 403 },
    stranger: { read: 404, write: 404, members: 404, share: 404, delete: 404 },
  } as const;

  for (const [who, row] of Object.entries(table))
    it(`${who}: read ${row.read} / write ${row.write} / members ${row.members} / share ${row.share} / delete ${row.delete}`, async () => {
      const doc = await fresh();
      const as = u[who as keyof TestUsers].id;
      const params = { id: doc.id };
      expect((await call(docRoute.GET, { as, params })).status).toBe(row.read);
      expect((await call(docRoute.PATCH, { as, params, method: "PATCH", body: { title: "x" } })).status).toBe(row.write);
      expect((await call(sharesRoute.GET, { as, params })).status).toBe(row.members);
      expect((await call(sharesRoute.PUT, { as, params, method: "PUT", body: { email: u.stranger.email, role: "viewer" } })).status).toBe(row.share);
      expect((await call(docRoute.DELETE, { as, params, method: "DELETE" })).status).toBe(row.delete);
    });

  it("viewer content write is 403 with the error shape", async () => {
    const doc = await fresh();
    const res = await call(docRoute.PATCH, { as: u.viewer.id, params: { id: doc.id }, method: "PATCH", body: { content: docWith("hi"), baseVersion: 1 } });
    expect(res.status).toBe(403);
    expect(res.json.error.code).toBe("FORBIDDEN");
  });

  it("members list: owner first; only the owner sees notes", async () => {
    const doc = await createDocument(u.owner.id, { title: "Members" });
    await upsertShare(u.owner.id, doc.id, { email: u.editor.email, role: "editor", note: "private ask" });
    await upsertShare(u.owner.id, doc.id, { email: u.viewer.email, role: "viewer" });
    const mine = await call(sharesRoute.GET, { as: u.owner.id, params: { id: doc.id } });
    expect(mine.json.map((m: { role: string }) => m.role)).toEqual(["owner", "editor", "viewer"]);
    expect(mine.json[1]).toMatchObject({ userId: u.editor.id, note: "private ask", noteSeenAt: null });
    for (const as of [u.editor.id, u.viewer.id]) {
      const theirs = await call(sharesRoute.GET, { as, params: { id: doc.id } });
      expect(theirs.json[0]).toEqual({ userId: u.owner.id, name: "Olivia Owner", email: u.owner.email, role: "owner" });
      for (const m of theirs.json) expect(Object.keys(m).sort()).toEqual(["email", "name", "role", "userId"]);
    }
  });

  it("no session → 401", async () => {
    const res = await call(listRoute.GET);
    expect(res).toMatchObject({ status: 401, json: { error: { code: "UNAUTHENTICATED" } } });
  });

  it("dashboard separates owned and shared", async () => {
    const doc = await fresh();
    const mine = await call(listRoute.GET, { as: u.owner.id });
    expect(mine.json.owned.map((d: { id: string }) => d.id)).toContain(doc.id);
    const theirs = await call(listRoute.GET, { as: u.viewer.id });
    expect(theirs.json.owned).toHaveLength(0);
    expect(theirs.json.shared.find((d: { id: string }) => d.id === doc.id)).toMatchObject({ role: "viewer", owner: { name: "Olivia Owner" } });
    expect((await call(listRoute.GET, { as: u.stranger.id })).json.shared.find((d: { id: string }) => d.id === doc.id)).toBeUndefined();
  });
});
