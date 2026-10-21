import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgEnum, pgTable, primaryKey, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { BlockMeta, DocJSON } from "@/lib/editor/types";

export const shareRole = pgEnum("share_role", ["viewer", "editor"]);
export const docSource = pgEnum("doc_source", ["blank", "import"]);

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  avatarHue: smallint("avatar_hue").notNull().default(210),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled document"),
    content: jsonb("content").$type<DocJSON>().notNull(),
    blockMeta: jsonb("block_meta").$type<BlockMeta>().notNull().default({}),
    version: integer("version").notNull().default(1),
    lastEditedBy: uuid("last_edited_by").references(() => users.id, { onDelete: "set null" }),
    source: docSource("source").notNull().default("blank"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("documents_owner_updated_idx").on(t.ownerId, t.updatedAt.desc()),
    check("documents_title_len", sql`char_length(${t.title}) <= 200`),
  ],
);

export const shares = pgTable(
  "shares",
  {
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: shareRole("role").notNull(),
    note: text("note"),
    noteSeenAt: ts("note_seen_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.documentId, t.userId] }),
    index("shares_user_idx").on(t.userId),
    check("shares_note_len", sql`char_length(${t.note}) <= 280`),
  ],
);

export const documentViews = pgTable(
  "document_views",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
    lastSeenAt: ts("last_seen_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.documentId] })],
);

export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Share = typeof shares.$inferSelect;
export type Role = "owner" | (typeof shareRole.enumValues)[number];
