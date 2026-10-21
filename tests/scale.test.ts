import { count, eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as docRoute from "@/app/api/documents/[id]/route";
import * as openRoute from "@/app/api/documents/[id]/open/route";
import * as sharesRoute from "@/app/api/documents/[id]/shares/route";
import * as sessionRoute from "@/app/api/session/route";
import * as usersRoute from "@/app/api/users/route";
import { documentViews, shares } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";
import { SESSION_COOKIE, signSession } from "@/lib/server/auth";
import { createDocument } from "@/lib/server/documents";
import { authed } from "@/lib/server/http";
import { resetRateLimits } from "@/lib/server/rate-limit";
import { call, docWith, freshDb, type TestUsers } from "./helpers";

let u: TestUsers;
beforeAll(async () => ({ u } = await freshDb()));
const newDoc = async () => (await createDocument(u.owner.id, { content: docWith("hi") })).id;
const put = (as: string, id: string, email: string, role = "editor") =>
  call(sharesRoute.PUT, { as, method: "PUT", params: { id }, body: { email, role } });
const rows = async (id: string) => (await getDb()).select().from(shares).where(eq(shares.documentId, id));

describe("rate limiting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetRateLimits();
  });
  afterEach(() => vi.useRealTimers());

  const read = (as: string, id: string) => call(docRoute.GET, { as, params: { id } });

  it("reads: 300/min then 429 with RATE_LIMITED and Retry-After", async () => {
    const id = await newDoc();
    for (let i = 0; i < 300; i++) expect((await read(u.owner.id, id)).status).toBe(200);
    const res = await read(u.owner.id, id);
    expect(res.status).toBe(429);
    expect(res.json.error.code).toBe("RATE_LIMITED");
    expect(res.json.error.details.retryAfter).toBeGreaterThan(0);
  });

  it("sends a Retry-After header", async () => {
    const h = authed(async () => new Response(null, { status: 204 }));
    const headers = { cookie: `${SESSION_COOKIE}=${await signSession(u.owner.id)}` };
    let res!: Response;
    for (let i = 0; i < 121; i++) res = await h(new Request("http://localhost/api/x", { method: "PUT", headers }), { params: Promise.resolve({}) });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("writes have their own 120/min budget; reads are unaffected", async () => {
    const id = await newDoc();
    for (let i = 0; i < 120; i++) expect((await call(docRoute.PATCH, { as: u.owner.id, params: { id }, method: "PATCH", body: { title: `t${i}` } })).status).toBe(200);
    expect((await call(docRoute.PATCH, { as: u.owner.id, params: { id }, method: "PATCH", body: { title: "over" } })).status).toBe(429);
    expect((await read(u.owner.id, id)).status).toBe(200);
  });

  it("window reset: allowed again after 60s", async () => {
    const id = await newDoc();
    for (let i = 0; i < 301; i++) await read(u.owner.id, id);
    expect((await read(u.owner.id, id)).status).toBe(429);
    vi.advanceTimersByTime(60_001);
    expect((await read(u.owner.id, id)).status).toBe(200);
  });

  it("per-user isolation: one user's limit does not affect another", async () => {
    const id = await newDoc();
    await put(u.owner.id, id, u.viewer.email, "viewer");
    for (let i = 0; i < 301; i++) await read(u.owner.id, id);
    expect((await read(u.owner.id, id)).status).toBe(429);
    expect((await read(u.viewer.id, id)).status).toBe(200);
  });

  it("opening a doc counts as a read, not a write", async () => {
    const id = await newDoc();
    for (let i = 0; i < 130; i++) expect((await call(openRoute.POST, { as: u.owner.id, method: "POST", params: { id }, url: `http://localhost/api/documents/${id}/open` })).status).toBe(200);
  });

  it("sign-in: 20/min per IP, other IPs unaffected", async () => {
    const go = (ip: string) => call(sessionRoute.POST, { method: "POST", body: { userId: u.owner.id }, headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });
    for (let i = 0; i < 20; i++) expect((await go("1.1.1.1")).status).toBe(200);
    const res = await go("1.1.1.1");
    expect(res.status).toBe(429);
    expect(res.json.error.code).toBe("RATE_LIMITED");
    expect((await go("2.2.2.2")).status).toBe(200);
  });

  it("public user list is limited per IP", async () => {
    const go = (ip: string) => call(usersRoute.GET, { headers: { "x-forwarded-for": ip } });
    for (let i = 0; i < 300; i++) await go("3.3.3.3");
    expect((await go("3.3.3.3")).status).toBe(429);
    expect((await go("4.4.4.4")).status).toBe(200);
  });
});

describe("concurrent access", () => {
  beforeEach(() => resetRateLimits());

  it("many opens of one doc: all succeed, one document_views row per user", async () => {
    const id = await newDoc();
    await put(u.owner.id, id, u.editor.email);
    await put(u.owner.id, id, u.viewer.email, "viewer");
    const who = [u.owner, u.editor, u.viewer];
    const res = await Promise.all(Array.from({ length: 60 }, (_, i) => call(openRoute.POST, { as: who[i % 3].id, method: "POST", params: { id } })));
    expect(res.every((r) => r.status === 200)).toBe(true);
    const [{ n }] = await (await getDb()).select({ n: count() }).from(documentViews).where(eq(documentViews.documentId, id));
    expect(n).toBe(3);
  });

  it("two tabs sharing with the same recipient at once: both succeed, exactly one row", async () => {
    const id = await newDoc();
    const res = await Promise.all([
      put(u.owner.id, id, u.viewer.email, "viewer"),
      put(u.owner.id, id, u.viewer.email, "editor"),
      put(u.owner.id, id, u.viewer.email, "viewer"),
    ]);
    expect(res.map((r) => r.status).every((s) => s === 200 || s === 201)).toBe(true);
    expect(await rows(id)).toHaveLength(1);
  });

  it("sharing with different recipients at once: independent rows, both succeed", async () => {
    const id = await newDoc();
    const res = await Promise.all([put(u.owner.id, id, u.viewer.email, "viewer"), put(u.owner.id, id, u.editor.email)]);
    expect(res.every((r) => r.status === 201)).toBe(true);
    expect(await rows(id)).toHaveLength(2);
  });

  it("delete racing a save: save gets 404 or lands first, never 500", async () => {
    const id = await newDoc();
    const [del, save] = await Promise.all([
      call(docRoute.DELETE, { as: u.owner.id, method: "DELETE", params: { id } }),
      call(docRoute.PATCH, { as: u.owner.id, method: "PATCH", params: { id }, body: { content: docWith("x"), baseVersion: 1 } }),
    ]);
    expect(del.status).toBe(204);
    expect([200, 404]).toContain(save.status);
  });
});
