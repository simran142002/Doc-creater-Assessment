import { beforeAll, describe, expect, it } from "vitest";
import * as docRoute from "@/app/api/documents/[id]/route";
import * as noteSeenRoute from "@/app/api/documents/[id]/note/seen/route";
import * as revokeRoute from "@/app/api/documents/[id]/shares/[userId]/route";
import * as sharesRoute from "@/app/api/documents/[id]/shares/route";
import { createDocument, saveDocument } from "@/lib/server/documents";
import { revokeShare } from "@/lib/server/shares";
import { call, docWith, freshDb, type TestUsers } from "./helpers";

let u: TestUsers;
beforeAll(async () => ({ u } = await freshDb()));

const put = (as: string, id: string, body: unknown) => call(sharesRoute.PUT, { as, method: "PUT", params: { id }, body });
const revoke = (as: string, id: string, userId: string) => call(revokeRoute.DELETE, { as, method: "DELETE", params: { id, userId } });
const newDoc = async () => (await createDocument(u.owner.id, { content: docWith("hi") })).id;

describe("share input", () => {
  it.each(["", "plainaddress", "a@", "@b.com", "a b@c.com", "a@b@c.com", "<script>@x.com"])("email %j → 400", async (email) => {
    expect(await put(u.owner.id, await newDoc(), { email, role: "viewer" })).toMatchObject({ status: 400, json: { error: { code: "VALIDATION" } } });
  });

  it.each(["owner", "admin", "", null, "Editor"])("role %j → 400", async (role) => {
    expect((await put(u.owner.id, await newDoc(), { email: u.editor.email, role })).status).toBe(400);
  });

  it("missing body fields → 400", async () => {
    expect((await put(u.owner.id, await newDoc(), {})).status).toBe(400);
  });

  it("unknown user → 422 USER_NOT_FOUND; owner sharing with self (any casing) → 422 SELF_SHARE", async () => {
    const id = await newDoc();
    expect(await put(u.owner.id, id, { email: "ghost@t.dev", role: "viewer" })).toMatchObject({ status: 422, json: { error: { code: "USER_NOT_FOUND" } } });
    expect(await put(u.owner.id, id, { email: "OWNER@T.DEV", role: "viewer" })).toMatchObject({ status: 422, json: { error: { code: "SELF_SHARE" } } });
  });

  it("notes: 280 ok, 281 → 400, whitespace-only → no note, control chars stripped, newlines kept", async () => {
    const id = await newDoc();
    expect((await put(u.owner.id, id, { email: u.viewer.email, role: "viewer", note: "n".repeat(280) })).status).toBe(201);
    expect((await put(u.owner.id, id, { email: u.viewer.email, role: "viewer", note: "n".repeat(281) })).status).toBe(400);
    expect((await put(u.owner.id, id, { email: u.viewer.email, role: "viewer", note: "  \n\t " })).json.note).toBeNull();
    expect((await put(u.owner.id, id, { email: u.viewer.email, role: "viewer", note: "line 1\r\nline\u0000 2\u0007" })).json.note).toBe("line 1\nline 2");
  });

  it("note: null clears it, omitting note keeps it", async () => {
    const id = await newDoc();
    await put(u.owner.id, id, { email: u.viewer.email, role: "viewer", note: "keep me" });
    expect((await put(u.owner.id, id, { email: u.viewer.email, role: "editor" })).json.note).toBe("keep me");
    expect((await put(u.owner.id, id, { email: u.viewer.email, role: "editor", note: null })).json.note).toBeNull();
  });

  it("editor and viewer cannot share (403); stranger gets 404", async () => {
    const id = await newDoc();
    await put(u.owner.id, id, { email: u.editor.email, role: "editor" });
    await put(u.owner.id, id, { email: u.viewer.email, role: "viewer" });
    expect((await put(u.editor.id, id, { email: u.stranger.email, role: "viewer" })).json.error.code).toBe("FORBIDDEN");
    expect((await put(u.viewer.id, id, { email: u.stranger.email, role: "viewer" })).status).toBe(403);
    expect((await put(u.stranger.id, id, { email: u.viewer.email, role: "editor" })).status).toBe(404);
  });

  it("re-share upserts (201 then 200, one row) and a promotion takes effect immediately", async () => {
    const id = await newDoc();
    expect((await put(u.owner.id, id, { email: u.viewer.email, role: "viewer" })).status).toBe(201);
    expect((await call(docRoute.PATCH, { as: u.viewer.id, method: "PATCH", params: { id }, body: { title: "x" } })).status).toBe(403);
    expect((await put(u.owner.id, id, { email: u.viewer.email, role: "editor" })).status).toBe(200);
    expect((await call(docRoute.PATCH, { as: u.viewer.id, method: "PATCH", params: { id }, body: { title: "x" } })).status).toBe(200);
    expect((await call(sharesRoute.GET, { as: u.owner.id, params: { id } })).json).toHaveLength(2);
  });
});

describe("revoke", () => {
  it("non-existent share → 404 (consistently, including garbage ids and repeats)", async () => {
    const id = await newDoc();
    for (const userId of [u.stranger.id, "not-a-uuid", "00000000-0000-4000-8000-000000000000"])
      expect(await revoke(u.owner.id, id, userId)).toMatchObject({ status: 404, json: { error: { code: "NOT_FOUND" } } });
  });

  it("revoking the owner → 400 VALIDATION", async () => {
    expect(await revoke(u.owner.id, await newDoc(), u.owner.id)).toMatchObject({ status: 400, json: { error: { code: "VALIDATION" } } });
  });

  it("editor or viewer cannot revoke (403), even themselves", async () => {
    const id = await newDoc();
    await put(u.owner.id, id, { email: u.editor.email, role: "editor" });
    expect((await revoke(u.editor.id, id, u.editor.id)).status).toBe(403);
  });

  it("revoked user's next GET, PATCH, members list and note-seen → 404", async () => {
    const id = await newDoc();
    await put(u.owner.id, id, { email: u.editor.email, role: "editor", note: "hi" });
    expect((await revoke(u.owner.id, id, u.editor.id)).status).toBe(204);
    const params = { id };
    expect((await call(docRoute.GET, { as: u.editor.id, params })).status).toBe(404);
    expect((await call(docRoute.PATCH, { as: u.editor.id, params, method: "PATCH", body: { content: docWith("x"), baseVersion: 1 } })).status).toBe(404);
    expect((await call(sharesRoute.GET, { as: u.editor.id, params })).status).toBe(404);
    expect((await call(noteSeenRoute.POST, { as: u.editor.id, params, method: "POST" })).status).toBe(404);
  });

  it("revoke racing an editor's in-flight save: the save either lands first or gets 404, never 500", async () => {
    const id = await newDoc();
    await put(u.owner.id, id, { email: u.editor.email, role: "editor" });
    const [save] = await Promise.allSettled([
      saveDocument(u.editor.id, id, { content: docWith("racing"), baseVersion: 1 }),
      revokeShare(u.owner.id, id, u.editor.id),
    ]);
    if (save.status === "rejected") expect(save.reason).toMatchObject({ code: "NOT_FOUND" });
    expect((await call(docRoute.PATCH, { as: u.editor.id, params: { id }, method: "PATCH", body: { title: "after" } })).status).toBe(404);
  });
});

describe("note seen", () => {
  it("owner (no share row) → 204 no-op; stranger → 404; garbage id → 404", async () => {
    const id = await newDoc();
    expect((await call(noteSeenRoute.POST, { as: u.owner.id, method: "POST", params: { id } })).status).toBe(204);
    expect((await call(noteSeenRoute.POST, { as: u.stranger.id, method: "POST", params: { id } })).status).toBe(404);
    expect((await call(noteSeenRoute.POST, { as: u.owner.id, method: "POST", params: { id: "nope" } })).status).toBe(404);
  });

  it("recipient without a note → 204, handoff stays null", async () => {
    const id = await newDoc();
    await put(u.owner.id, id, { email: u.viewer.email, role: "viewer" });
    expect((await call(noteSeenRoute.POST, { as: u.viewer.id, method: "POST", params: { id } })).status).toBe(204);
    expect((await call(docRoute.GET, { as: u.viewer.id, params: { id } })).json.handoff).toBeNull();
  });
});
