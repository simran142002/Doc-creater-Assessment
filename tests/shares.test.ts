import { beforeAll, describe, expect, it } from "vitest";
import * as docRoute from "@/app/api/documents/[id]/route";
import * as revokeRoute from "@/app/api/documents/[id]/shares/[userId]/route";
import * as sharesRoute from "@/app/api/documents/[id]/shares/route";
import { createDocument, getDocument, markNoteSeen } from "@/lib/server/documents";
import { call, freshDb, type TestUsers } from "./helpers";

let u: TestUsers;
beforeAll(async () => ({ u } = await freshDb()));

const put = (as: string, id: string, body: unknown) => call(sharesRoute.PUT, { as, method: "PUT", params: { id }, body });

describe("share validation", () => {
  it("rejects self, unknown email, bad role, long note and non-owners", async () => {
    const { id } = await createDocument(u.owner.id, {});
    expect((await put(u.owner.id, id, { email: u.owner.email, role: "editor" })).json.error.code).toBe("SELF_SHARE");
    expect(await put(u.owner.id, id, { email: "nobody@t.dev", role: "editor" })).toMatchObject({ status: 422, json: { error: { code: "USER_NOT_FOUND" } } });
    expect((await put(u.owner.id, id, { email: u.editor.email, role: "admin" })).status).toBe(400);
    expect((await put(u.owner.id, id, { email: "not-an-email", role: "viewer" })).status).toBe(400);
    expect((await put(u.owner.id, id, { email: u.editor.email, role: "viewer", note: "n".repeat(281) })).status).toBe(400);
    await put(u.owner.id, id, { email: u.editor.email, role: "editor" });
    expect((await put(u.editor.id, id, { email: u.viewer.email, role: "viewer" })).status).toBe(403);
  });

  it("upserts: re-share updates role; email is case-insensitive; a changed note is unread again", async () => {
    const { id } = await createDocument(u.owner.id, {});
    const first = await put(u.owner.id, id, { email: "VIEWER@t.dev", role: "viewer", note: "First look" });
    expect(first).toMatchObject({ status: 201, json: { role: "viewer", note: "First look", noteSeenAt: null } });

    await markNoteSeen(u.viewer.id, id);
    expect((await getDocument(u.viewer.id, id)).handoff?.unread).toBe(false);

    const again = await put(u.owner.id, id, { email: u.viewer.email, role: "editor" });
    expect(again).toMatchObject({ status: 200, json: { role: "editor", note: "First look" } });
    expect(again.json.noteSeenAt).not.toBeNull();

    const renote = await put(u.owner.id, id, { email: u.viewer.email, role: "editor", note: "Updated ask" });
    expect(renote.json.noteSeenAt).toBeNull();

    const list = await call(sharesRoute.GET, { as: u.owner.id, params: { id } });
    expect(list.json.map((m: { role: string }) => m.role)).toEqual(["owner", "editor"]);
  });

  it("revoke removes access (recipient then gets 404)", async () => {
    const { id } = await createDocument(u.owner.id, {});
    await put(u.owner.id, id, { email: u.viewer.email, role: "viewer" });
    expect((await call(docRoute.GET, { as: u.viewer.id, params: { id } })).status).toBe(200);
    const del = await call(revokeRoute.DELETE, { as: u.owner.id, method: "DELETE", params: { id, userId: u.viewer.id } });
    expect(del.status).toBe(204);
    expect((await call(docRoute.GET, { as: u.viewer.id, params: { id } })).status).toBe(404);
    expect((await call(revokeRoute.DELETE, { as: u.owner.id, method: "DELETE", params: { id, userId: u.viewer.id } })).status).toBe(404);
  });
});
