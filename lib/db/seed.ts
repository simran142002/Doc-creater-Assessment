import { sql } from "drizzle-orm";
import type { BlockMeta, DocJSON, JSONNode } from "@/lib/editor/types";
import { hashBlock } from "@/lib/server/catchup";
import { validateDoc } from "@/lib/server/content";
import type { DB } from "./client";
import { documents, documentViews, shares, users } from "./schema";

export const SEED_USERS = [
  { email: "aarav@ajaia.dev", name: "Aarav Mehta", avatarHue: 210 },
  { email: "priya@ajaia.dev", name: "Priya Sharma", avatarHue: 330 },
  { email: "leo@ajaia.dev", name: "Leo Fernandes", avatarHue: 140 },
];

const txt = (text: string, marks?: string[]): JSONNode => ({ type: "text", text, ...(marks && { marks: marks.map((type) => ({ type })) }) });
const p = (id: string, ...content: JSONNode[]): JSONNode => ({ type: "paragraph", attrs: { id }, content });
const h = (id: string, level: number, text: string): JSONNode => ({ type: "heading", attrs: { id, level }, content: [txt(text)] });
const list = (id: string, type: "bulletList" | "orderedList", items: string[]): JSONNode => ({
  type, attrs: { id, ...(type === "orderedList" && { start: 1, type: null }) },
  content: items.map((t) => ({ type: "listItem", content: [{ type: "paragraph", attrs: { id: null }, content: [txt(t)] }] })),
});
const doc = (...content: JSONNode[]): DocJSON => validateDoc({ type: "doc", content });

const ago = (hours: number) => new Date(Date.now() - hours * 3600_000);

/** Stamps every block; `edits` overrides who/when per block id. */
function meta(d: DocJSON, by: string, at: Date, edits: Record<string, { by: string; at: Date }> = {}): BlockMeta {
  return Object.fromEntries((d.content ?? []).map((b) => {
    const e = edits[b.attrs!.id as string] ?? { by, at };
    return [b.attrs!.id as string, { h: hashBlock(b), by: e.by, at: e.at.toISOString() }];
  }));
}

const ID = {
  welcome: "00000000-0000-4000-8000-000000000001",
  launch: "00000000-0000-4000-8000-000000000002",
  review: "00000000-0000-4000-8000-000000000003",
  budget: "00000000-0000-4000-8000-000000000004",
};

export async function seed(db: DB) {
  const rows = await db.insert(users).values(SEED_USERS)
    .onConflictDoUpdate({ target: users.email, set: { name: sql`excluded.name` } })
    .returning({ id: users.id, email: users.email });
  const u = Object.fromEntries(rows.map((r) => [r.email.split("@")[0], r.id])) as Record<"aarav" | "priya" | "leo", string>;

  const welcome = doc(
    h("b-w1", 1, "Welcome to Ajaia Docs"),
    p("b-w2", txt("Write with "), txt("bold", ["bold"]), txt(", "), txt("italic", ["italic"]), txt(" and "), txt("underline", ["underline"]), txt(".")),
    list("b-w3", "bulletList", ["Share with a teammate and leave a handoff note", "Import .txt, .md or .docx files"]),
    list("b-w4", "orderedList", ["Create a doc", "Share it", "See what changed when you come back"]),
  );
  const launch = doc(
    h("b-l1", 1, "Launch checklist"),
    h("b-l2", 2, "Rollout"),
    p("b-l3", txt("Ship to 10% of workspaces on Monday, then 50% on Wednesday.")),
    list("b-l4", "bulletList", ["Status page copy", "Support macros", "Rollback plan"]),
  );
  const review = doc(
    h("b-r1", 1, "Design review: onboarding"),
    p("b-r2", txt("Goal: get a new teammate to their first shared doc in under two minutes.")),
    h("b-r3", 2, "Open questions"),
    list("b-r4", "bulletList", ["Do we need an empty-state video?", "Who owns the welcome doc copy?", "Skip the tour for invited users"]),
    h("b-r5", 2, "Decision"),
    p("b-r6", txt("Ship the checklist variant; ", ["bold"]), txt("revisit the tour after two weeks of data.")),
  );
  const budget = doc(
    h("b-b1", 1, "Q4 budget notes"),
    p("b-b2", txt("Read-only for most of the team. Ping Leo for changes.")),
  );

  // Priya edited three blocks of her review doc an hour ago, after Aarav last looked (two days ago).
  const recent = { by: u.priya, at: ago(1) };
  const docs = [
    { id: ID.welcome, ownerId: u.aarav, title: "Welcome to Ajaia Docs", content: welcome, blockMeta: meta(welcome, u.aarav, ago(72)), lastEditedBy: u.aarav, updatedAt: ago(72) },
    { id: ID.launch, ownerId: u.aarav, title: "Launch checklist", content: launch, blockMeta: meta(launch, u.aarav, ago(24)), lastEditedBy: u.aarav, updatedAt: ago(24) },
    {
      id: ID.review, ownerId: u.priya, title: "Design review: onboarding", content: review, version: 4,
      blockMeta: meta(review, u.priya, ago(96), { "b-r4": recent, "b-r5": recent, "b-r6": recent }),
      lastEditedBy: u.priya, updatedAt: ago(1),
    },
    { id: ID.budget, ownerId: u.leo, title: "Q4 budget notes", content: budget, blockMeta: meta(budget, u.leo, ago(120)), lastEditedBy: u.leo, updatedAt: ago(120) },
  ];
  const inserted = await db.insert(documents).values(docs).onConflictDoNothing().returning({ id: documents.id });
  if (!inserted.length) return { users: rows.length, documents: 0 };

  await db.insert(shares).values([
    { documentId: ID.launch, userId: u.priya, role: "editor", note: "Can you tighten the Rollout section before Thursday's go/no-go?" },
    { documentId: ID.review, userId: u.aarav, role: "editor", note: "Notes from Tuesday's review.", noteSeenAt: ago(48) },
    { documentId: ID.budget, userId: u.aarav, role: "viewer" },
  ]).onConflictDoNothing();
  await db.insert(documentViews).values([
    { userId: u.aarav, documentId: ID.welcome, lastSeenAt: ago(72) },
    { userId: u.aarav, documentId: ID.launch, lastSeenAt: ago(24) },
    { userId: u.priya, documentId: ID.review, lastSeenAt: ago(1) },
    { userId: u.aarav, documentId: ID.review, lastSeenAt: ago(48) },
    { userId: u.leo, documentId: ID.budget, lastSeenAt: ago(120) },
    { userId: u.aarav, documentId: ID.budget, lastSeenAt: ago(100) },
  ]).onConflictDoNothing();
  return { users: rows.length, documents: inserted.length };
}
