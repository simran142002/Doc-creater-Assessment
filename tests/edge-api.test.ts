import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as docRoute from "@/app/api/documents/[id]/route";
import * as openRoute from "@/app/api/documents/[id]/open/route";
import * as listRoute from "@/app/api/documents/route";
import * as meRoute from "@/app/api/me/route";
import * as sessionRoute from "@/app/api/session/route";
import { setDb, type DB } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { signSession } from "@/lib/server/auth";
import { errorResponse } from "@/lib/server/http";
import { call, docWith, freshDb, type TestUsers } from "./helpers";

let db: DB, u: TestUsers;
beforeAll(async () => ({ db, u } = await freshDb()));
afterEach(() => vi.restoreAllMocks());

const key = new TextEncoder().encode(process.env.SESSION_SECRET);
const unauth = { status: 401, json: { error: { code: "UNAUTHENTICATED" } } };

describe("auth edge cases", () => {
  it("no cookie, empty cookie, garbage cookie → 401", async () => {
    expect(await call(meRoute.GET)).toMatchObject(unauth);
    expect(await call(meRoute.GET, { cookie: "" })).toMatchObject(unauth);
    expect(await call(meRoute.GET, { cookie: "not.a.jwt" })).toMatchObject(unauth);
  });

  it("tampered signature, wrong secret, alg=none and expired tokens → 401", async () => {
    const good = await signSession(u.owner.id);
    const [h, p, sig] = good.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: u.editor.id, exp: 9e9 })).toString("base64url");
    expect(await call(meRoute.GET, { cookie: `${h}.${forgedPayload}.${sig}` })).toMatchObject(unauth);
    expect(await call(meRoute.GET, { cookie: `${h}.${p}.${sig.slice(0, -2)}xx` })).toMatchObject(unauth);
    const other = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(u.owner.id).sign(new TextEncoder().encode("x".repeat(40)));
    expect(await call(meRoute.GET, { cookie: other })).toMatchObject(unauth);
    const none = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${p}.`;
    expect(await call(meRoute.GET, { cookie: none })).toMatchObject(unauth);
    const expired = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(u.owner.id).setExpirationTime(Math.floor(Date.now() / 1000) - 60).sign(key);
    expect(await call(meRoute.GET, { cookie: expired })).toMatchObject(unauth);
  });

  it("validly signed token whose subject is not a uuid → 401, not 500", async () => {
    const odd = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("admin").setExpirationTime("1h").sign(key);
    expect(await call(meRoute.GET, { cookie: odd })).toMatchObject(unauth);
  });

  it("cookie for a user who no longer exists → 401", async () => {
    const [ghost] = await db.insert(users).values({ email: "ghost@t.dev", name: "Ghost" }).returning();
    const token = await signSession(ghost.id);
    expect((await call(meRoute.GET, { cookie: token })).status).toBe(200);
    await db.delete(users).where(eq(users.id, ghost.id));
    expect(await call(meRoute.GET, { cookie: token })).toMatchObject(unauth);
  });

  it("sign-in: unknown user 404, malformed id / missing body 400, success sets an httpOnly cookie", async () => {
    const post = (body: unknown) => call(sessionRoute.POST, { method: "POST", body });
    expect(await post({ userId: "00000000-0000-4000-8000-000000000000" })).toMatchObject({ status: 404, json: { error: { code: "NOT_FOUND" } } });
    expect(await post({ userId: "1; drop table users" })).toMatchObject({ status: 400, json: { error: { code: "VALIDATION" } } });
    expect((await post({})).status).toBe(400);
    expect((await call(sessionRoute.POST, { method: "POST" })).status).toBe(400);
    const req = new Request("http://localhost/api/session", { method: "POST", body: JSON.stringify({ userId: u.owner.id }) });
    const res = await sessionRoute.POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/ajaia_session=.+HttpOnly/i);
  });

  it("sign-out without a session is still 204 and clears the cookie", async () => {
    const req = new Request("http://localhost/api/session", { method: "DELETE" });
    const res = await sessionRoute.DELETE(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(204);
    expect(res.headers.get("set-cookie")).toMatch(/Max-Age=0/i);
  });
});

describe("input edge cases", () => {
  const newDoc = async () => (await call(listRoute.POST, { as: u.owner.id, method: "POST", body: { content: docWith("a") } })).json.id as string;

  it("malformed JSON → 400 VALIDATION", async () => {
    const id = await newDoc();
    for (const raw of ["{", "{'a':1}", "undefined", "\u0000"])
      expect(await call(docRoute.PATCH, { as: u.owner.id, method: "PATCH", params: { id }, raw })).toMatchObject({ status: 400, json: { error: { code: "VALIDATION" } } });
  });

  it("JSON that is not an object (null, array, string) → 400", async () => {
    const id = await newDoc();
    for (const raw of ["null", "[]", '"title"', "42"])
      expect((await call(docRoute.PATCH, { as: u.owner.id, method: "PATCH", params: { id }, raw })).status).toBe(400);
  });

  it("content-type is not enforced: text/plain (sendBeacon/keepalive) PATCH is accepted", async () => {
    const id = await newDoc();
    const res = await call(docRoute.PATCH, {
      as: u.owner.id, method: "PATCH", params: { id }, headers: { "content-type": "text/plain;charset=UTF-8" },
      raw: JSON.stringify({ content: docWith("flushed"), baseVersion: 1 }),
    });
    expect(res).toMatchObject({ status: 200, json: { version: 2 } });
  });

  it("unknown fields are stripped, never stored or echoed", async () => {
    const res = await call(listRoute.POST, { as: u.owner.id, method: "POST", body: { title: "T", ownerId: u.editor.id, version: 99, isAdmin: true } });
    expect(res.status).toBe(201);
    expect(res.json).toMatchObject({ title: "T", version: 1, owner: { id: u.owner.id } });
    expect(res.json.isAdmin).toBeUndefined();
  });

  it.each(["not-a-uuid", "123", "' OR 1=1 --", "00000000-0000-0000-0000-00000000000g", "%00", "a".repeat(5000)])(
    "garbage :id %s → 404 on every doc route",
    async (id) => {
      const as = u.owner.id;
      expect((await call(docRoute.GET, { as, params: { id } })).status).toBe(404);
      expect((await call(docRoute.PATCH, { as, params: { id }, method: "PATCH", body: { title: "x" } })).status).toBe(404);
      expect((await call(docRoute.DELETE, { as, params: { id }, method: "DELETE" })).status).toBe(404);
      expect((await call(openRoute.POST, { as, params: { id }, method: "POST" })).status).toBe(404);
    },
  );

  it("request bodies over the cap → 413 before parsing (Content-Length and actual size)", async () => {
    const id = await newDoc();
    const big = "x".repeat(1024 * 1024 + 20 * 1024);
    expect((await call(docRoute.PATCH, { as: u.owner.id, method: "PATCH", params: { id }, raw: big })).status).toBe(413);
    const lying = await call(docRoute.PATCH, { as: u.owner.id, method: "PATCH", params: { id }, raw: "{}", headers: { "content-length": String(50 * 1024 * 1024) } });
    expect(lying.status).toBe(413);
  });

  it("cross-origin and opaque (null) Origin mutations → 403, same origin passes", async () => {
    const id = await newDoc();
    const send = (origin: string) => call(docRoute.PATCH, { as: u.owner.id, method: "PATCH", params: { id }, body: { title: "o" }, headers: { origin } });
    expect((await send("https://evil.example")).status).toBe(403);
    expect((await send("null")).status).toBe(403);
    expect((await send("http://localhost")).status).toBe(200);
  });
});

describe("server errors", () => {
  it("unexpected exceptions → 500 INTERNAL, generic message, no stack, logged server-side", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const boom = new Error("connection reset at /srv/secret/path.ts:42");
    setDb(new Proxy({} as DB, { get: (_, k) => (k === "then" ? undefined : () => { throw boom; }) }));
    try {
      const res = await call(listRoute.GET, { as: u.owner.id });
      expect(res.status).toBe(500);
      expect(res.json).toEqual({ error: { code: "INTERNAL", message: "Something went wrong." } });
      expect(res.text).not.toMatch(/secret|stack|\.ts:/);
      expect(log).toHaveBeenCalledWith(expect.stringContaining("GET /api/test"), boom);
    } finally {
      setDb(db);
    }
  });

  it("DB constraint errors map to 409/404/400 instead of 500", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const dup = await db.insert(users).values({ email: u.owner.email, name: "Dup" }).catch((e) => e);
    expect(errorResponse(dup).status).toBe(409);
    expect((await errorResponse(dup).json()).error.code).toBe("CONFLICT");
    expect(errorResponse({ cause: { code: "23503" } }).status).toBe(404);
    expect(errorResponse({ code: "23514" }).status).toBe(400);
  });
});
