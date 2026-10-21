import { createPglite, setDb, type DB } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { resetRateLimits } from "@/lib/server/rate-limit";
import { SESSION_COOKIE, signSession } from "@/lib/server/auth";

export type TestUsers = Record<"owner" | "editor" | "viewer" | "stranger", { id: string; name: string; email: string }>;

export async function freshDb(): Promise<{ db: DB; u: TestUsers }> {
  resetRateLimits();
  const db = await createPglite();
  setDb(db);
  const rows = await db.insert(users).values([
    { email: "owner@t.dev", name: "Olivia Owner" },
    { email: "editor@t.dev", name: "Eddie Editor" },
    { email: "viewer@t.dev", name: "Vera Viewer" },
    { email: "stranger@t.dev", name: "Sam Stranger" },
  ]).returning();
  const u = Object.fromEntries(rows.map((r) => [r.email.split("@")[0], r])) as unknown as TestUsers;
  return { db, u };
}

export async function call<P>(
  handler: (req: Request, ctx: { params: Promise<P> }) => Promise<Response>,
  opts: { method?: string; as?: string; cookie?: string; body?: unknown; raw?: string; form?: FormData; params?: P; headers?: Record<string, string>; url?: string } = {},
) {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.as) headers.cookie = `${SESSION_COOKIE}=${await signSession(opts.as)}`;
  if (opts.cookie !== undefined) headers.cookie = `${SESSION_COOKIE}=${opts.cookie}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.raw !== undefined) body = opts.raw;
  else if (opts.body !== undefined) {
    headers["content-type"] ??= "application/json";
    body = JSON.stringify(opts.body);
  }
  const req = new Request(opts.url ?? "http://localhost/api/test", { method: opts.method ?? "GET", headers, body });
  const res = await handler(req, { params: Promise.resolve((opts.params ?? {}) as P) });
  const text = await res.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { status: res.status, text, json: (text ? JSON.parse(text) : null) as any };
}

export const docWith = (...texts: string[]) => ({
  type: "doc",
  content: texts.map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })),
});
